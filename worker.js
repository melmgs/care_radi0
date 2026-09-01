const JSON_HEADERS={
  "content-type":"application/json; charset=utf-8",
  "cache-control":"no-store"
};

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:JSON_HEADERS
  });
}

function logWorkerError(label,error){
  console.error(label,{
    message:error?.message||String(error),
    cause:error?.cause?.message||null,
    stack:error?.stack||null
  });
}

function textValue(value,maxLength){
  return String(value??"").trim().slice(0,maxLength);
}

function escapeHTML(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function safeHTTPURL(value){
  try{
    const url=new URL(value);
    return url.protocol==="http:"||url.protocol==="https:";
  }catch{
    return false;
  }
}

async function ensureSchema(env){
  if(!env.DB){
    throw new Error("D1 binding unavailable");
  }
}

async function proxyJSON(request,prefix,origin){
  if(request.method!=="GET"&&request.method!=="HEAD"){
    return new Response("Method not allowed",{
      status:405,
      headers:{"allow":"GET, HEAD"}
    });
  }

  const incoming=new URL(request.url);
  const suffix=incoming.pathname.slice(prefix.length)||"/";
  const target=new URL(suffix+incoming.search,origin);

  const upstream=await fetch(target.toString(),{
    method:request.method,
    headers:{
      "accept":"application/json",
      "user-agent":"care-radi0/1.0"
    },
    cf:{
      cacheTtl:300,
      cacheEverything:true
    }
  });

  const headers=new Headers();
  const contentType=upstream.headers.get("content-type");
  if(contentType)headers.set("content-type",contentType);
  headers.set("cache-control","public, max-age=300");

  return new Response(upstream.body,{
    status:upstream.status,
    statusText:upstream.statusText,
    headers
  });
}

async function handleSubmission(request,env){
  if(request.method!=="POST"){
    return json({ok:false,error:"method not allowed"},405);
  }

  try{
    await ensureSchema(env);
  }catch(error){
    logWorkerError("D1 setup error",error);
    return json({ok:false,error:"submission storage unavailable"},503);
  }

  let form;
  try{
    form=await request.formData();
  }catch{
    return json({ok:false,error:"invalid form"},400);
  }

  // Honeypot: pretend success so bots do not learn anything.
  if(textValue(form.get("bot-field"),200)){
    return json({ok:true});
  }

  const artistName=textValue(form.get("artist_name"),160);
  const musicLink=textValue(form.get("music_link"),2048);
  const instagram=textValue(form.get("instagram"),160);
  const note=textValue(form.get("note"),3000);

  if(!artistName||!musicLink){
    return json({ok:false,error:"missing required fields"},422);
  }

  if(!safeHTTPURL(musicLink)){
    return json({ok:false,error:"invalid music link"},422);
  }

  const id=crypto.randomUUID();
  const createdAt=new Date().toISOString();

  try{
    await env.DB.prepare(`
      INSERT INTO submissions
      (id,created_at,artist_name,music_link,instagram,note)
      VALUES (?,?,?,?,?,?)
    `).bind(
      id,
      createdAt,
      artistName,
      musicLink,
      instagram,
      note
    ).run();
  }catch(error){
    logWorkerError("submission insert error",error);
    return json({ok:false,error:"submission failed"},500);
  }

  return json({ok:true});
}

function unauthorized(){
  return new Response("Authentication required",{
    status:401,
    headers:{
      "www-authenticate":'Basic realm="care_radi0 submissions", charset="UTF-8"',
      "cache-control":"no-store"
    }
  });
}

function adminAllowed(request,env){
  if(!env.ADMIN_PASSWORD)return false;

  const auth=request.headers.get("authorization")||"";
  if(!auth.startsWith("Basic "))return false;

  try{
    const decoded=atob(auth.slice(6));
    const separator=decoded.indexOf(":");
    if(separator===-1)return false;

    const username=decoded.slice(0,separator);
    const password=decoded.slice(separator+1);

    return username==="care"&&password===env.ADMIN_PASSWORD;
  }catch{
    return false;
  }
}

async function getSubmissions(env){
  await ensureSchema(env);

  const result=await env.DB.prepare(`
    SELECT id,created_at,artist_name,music_link,instagram,note
    FROM submissions
    ORDER BY created_at DESC
    LIMIT 200
  `).all();

  return result.results||[];
}

function adminPage(rows){
  const items=rows.map(row=>{
    const date=new Date(row.created_at).toLocaleString("en-GB",{
      timeZone:"Europe/Paris",
      dateStyle:"medium",
      timeStyle:"short"
    });

    const insta=row.instagram
      ?`<div class="muted">${escapeHTML(row.instagram)}</div>`
      :"";

    const note=row.note
      ?`<div class="note">${escapeHTML(row.note)}</div>`
      :"";

    return `
      <article>
        <div class="date">${escapeHTML(date)}</div>
        <h2>${escapeHTML(row.artist_name)}</h2>
        <a href="${escapeHTML(row.music_link)}" target="_blank" rel="noreferrer">${escapeHTML(row.music_link)}</a>
        ${insta}
        ${note}
      </article>
    `;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>care_radi0 submissions</title>
<style>
  :root{--blue:#071cff;--red:#ff2817}
  *{box-sizing:border-box}
  body{margin:0;background:var(--blue);color:white;font-family:Arial,sans-serif;padding:24px}
  header{display:flex;gap:20px;align-items:baseline;justify-content:space-between;position:sticky;top:0;background:var(--blue);padding:6px 0 20px}
  h1{margin:0;color:var(--red);font-size:clamp(42px,9vw,110px);font-weight:400;letter-spacing:-.06em;line-height:.8}
  header a{color:white;font-size:12px}
  main{max-width:980px;margin-top:46px}
  article{padding:20px 0 28px;border-top:1px solid rgba(255,255,255,.35)}
  h2{color:var(--red);font-size:28px;font-weight:400;margin:8px 0}
  a{color:white;overflow-wrap:anywhere}
  .date,.muted{opacity:.55;font-size:12px}
  .muted{margin-top:8px}
  .note{margin-top:18px;max-width:720px;white-space:pre-wrap;font-size:17px;line-height:1.25}
  .empty{opacity:.6}
</style>
</head>
<body>
<header>
  <h1>submissions</h1>
  <a href="/admin/submissions.csv">download csv</a>
</header>
<main>${items||'<p class="empty">nothing here yet.</p>'}</main>
</body>
</html>`;
}

function csvCell(value){
  return `"${String(value??"").replaceAll('"','""')}"`;
}

function submissionsCSV(rows){
  const head=["created_at","artist_name","music_link","instagram","note"];
  const lines=[head.map(csvCell).join(",")];

  for(const row of rows){
    lines.push([
      row.created_at,
      row.artist_name,
      row.music_link,
      row.instagram,
      row.note
    ].map(csvCell).join(","));
  }

  return lines.join("\r\n");
}

async function handleAdmin(request,env,wantsCSV=false){
  if(!adminAllowed(request,env))return unauthorized();

  let rows;
  try{
    rows=await getSubmissions(env);
  }catch(error){
    logWorkerError("admin D1 error",error);
    return new Response("Submission storage unavailable",{status:503});
  }

  if(wantsCSV){
    return new Response(submissionsCSV(rows),{
      headers:{
        "content-type":"text/csv; charset=utf-8",
        "content-disposition":"attachment; filename=care-radi0-submissions.csv",
        "cache-control":"no-store"
      }
    });
  }

  return new Response(adminPage(rows),{
    headers:{
      "content-type":"text/html; charset=utf-8",
      "cache-control":"no-store",
      "x-robots-tag":"noindex, nofollow"
    }
  });
}

export default {
  async fetch(request,env){
    const url=new URL(request.url);

    try{
      if(url.pathname.startsWith("/itunes/")){
        return proxyJSON(request,"/itunes","https://itunes.apple.com");
      }

      if(url.pathname.startsWith("/deezer/")){
        return proxyJSON(request,"/deezer","https://api.deezer.com");
      }

      if(url.pathname==="/api/submit"){
        return handleSubmission(request,env);
      }

      if(url.pathname==="/admin/submissions"){
        return handleAdmin(request,env,false);
      }

      if(url.pathname==="/admin/submissions.csv"){
        return handleAdmin(request,env,true);
      }

      return env.ASSETS.fetch(request);
    }catch(error){
      console.error("worker error",error);
      return new Response("care_radi0 had a little moment",{status:500});
    }
  }
};
