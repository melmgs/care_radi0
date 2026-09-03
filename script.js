/* ============================================
   CARE RADIO — PLAYER / METADATA / POLISH
============================================ */

const STREAM_URL="https://eu8.fastcast4u.com/proxy/melmgs?mp=/1";
const FEED="https://eu8.fastcast4u.com/recentfeed/melmgs/html/";

const audio=document.getElementById("audio");
const playButton=document.getElementById("playButton");
const player=document.getElementById("player");
const audioStatus=document.getElementById("audioStatus");
const nowCard=document.querySelector(".now-card");
const recentShell=document.querySelector(".recent-shell");
const recentViewport=document.querySelector(".recent-viewport");
const recent=document.getElementById("recent");
const cover=document.getElementById("cover");
const streamMessage=document.getElementById("streamMessage");
const historyOverlay=document.getElementById("historyOverlay");
const historyList=document.getElementById("historyList");
const notesOverlay=document.getElementById("notesOverlay");
const notesList=document.getElementById("notesList");
const heardOverlay=document.getElementById("heardOverlay");
const heardList=document.getElementById("heardList");
const submitOverlay=document.getElementById("submitOverlay");
const programsOverlay=document.getElementById("programsOverlay");
const submitMusic=document.getElementById("submitMusic");
const programsTrigger=document.getElementById("programsTrigger");
const shareMenu=document.getElementById("shareMenu");
const shareCurrent=document.getElementById("shareCurrent");
const shareTrackButton=document.getElementById("shareTrackButton");
const copyTrackButton=document.getElementById("copyTrackButton");
const shareFeedback=document.getElementById("shareFeedback");
const musicSubmitForm=document.getElementById("musicSubmitForm");
const submitStatus=document.getElementById("submitStatus");

const careLogo=document.getElementById("careLogo");
const listenNote=document.getElementById("listenNote");

const miniPlayer=document.getElementById("miniPlayer");
const miniArtist=document.getElementById("miniArtist");
const miniTitle=document.getElementById("miniTitle");
const miniPlayButton=document.getElementById("miniPlayButton");

const listeningOverlay=document.getElementById("listeningOverlay");
const listeningCover=document.getElementById("listeningCover");
const listeningTitle=document.getElementById("listeningTitle");
const listeningArtist=document.getElementById("listeningArtist");
const listeningPlayButton=document.getElementById("listeningPlayButton");

const landscapeCover=document.getElementById("landscapeCover");
const landscapeTitle=document.getElementById("landscapeTitle");
const landscapeArtist=document.getElementById("landscapeArtist");
const landscapePlayButton=document.getElementById("landscapePlayButton");

const programsList=document.getElementById("programsList");
const terminalTrigger=document.getElementById("terminalTrigger");
const terminalDock=document.getElementById("terminalDock");
const terminalLog=document.getElementById("terminalLog");
const terminalForm=document.getElementById("terminalForm");
const terminalInput=document.getElementById("terminalInput");

const programmeList=document.getElementById("programmeList");
const programmeSection=document.getElementById("programme");
const currentProgramStatus=document.getElementById("currentProgramStatus");
const currentProgramName=document.getElementById("currentProgramName");

let userWantsPlayback=false;
let reconnectTimer=null;
let reconnectAttempts=0;
let stallTimer=null;

let artworkRequestId=0;
let lastArtworkKey="";
let currentTrackKey="";
let currentTrack={
  artist:"",
  title:"",
  album:"",
  artwork:""
};

let recentTracksCache=[];
let historyTracksCache=[];
let resizeTimer=null;
let renderCurrentTimer=null;

let listeningSeconds=0;
let listenNoteTimer=null;
const listeningMilestones=new Set();

let playerIsInView=true;

let editorialData={
  programme:[],
  notes:[],
  track_notes:{}
};

let programsData={
  default_program:"",
  programs:[]
};


/* ---------- FUTURE EDITORIAL DATA ---------- */

async function loadEditorialData(){
  try{
    const response=await fetch("./editorial.json",{cache:"no-store"});
    if(!response.ok)throw new Error();

    const data=await response.json();

    editorialData={
      programme:Array.isArray(data.programme)?data.programme:[],
      notes:Array.isArray(data.notes)?data.notes:[],
      track_notes:
        data.track_notes && typeof data.track_notes==="object"
          ?data.track_notes
          :{}
    };
  }catch(error){
    editorialData={programme:[],notes:[],track_notes:{}};
  }

  renderProgramme();
  updateCurrentProgramStatus();
}

async function loadProgramsData(){
  try{
    const response=await fetch("./programs.json",{cache:"no-store"});
    if(!response.ok)throw new Error();

    const data=await response.json();

    programsData={
      default_program:String(data.default_program||""),
      programs:Array.isArray(data.programs)?data.programs:[]
    };
  }catch(error){
    programsData={default_program:"",programs:[]};
  }

  updateProgramsTrigger();
  renderPrograms();
  renderProgramme();
  updateCurrentProgramStatus();
}

loadEditorialData();
loadProgramsData();


/* ---------- HELPERS ---------- */

function escapeHTML(value){
  return String(value||"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}


/* ---------- PROGRAMS + PROGRAMME ---------- */

function activePrograms(){
  return programsData.programs.filter(program=>program&&program.active!==false);
}

function getProgramById(id){
  const key=String(id||"").trim();
  if(!key)return null;
  return programsData.programs.find(program=>String(program?.id||"")===key)||null;
}

function getDefaultProgram(){
  return (
    getProgramById(programsData.default_program) ||
    activePrograms().find(program=>program.featured) ||
    activePrograms()[0] ||
    null
  );
}


function parseProgrammeDate(value){
  const clean=String(value||"").trim();
  let match=clean.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2}|\d{4})$/);
  if(match){
    let year=Number(match[3]);
    if(year<100)year+=2000;
    return{year,month:Number(match[2]),day:Number(match[1])};
  }

  match=clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if(match){
    return{year:Number(match[1]),month:Number(match[2]),day:Number(match[3])};
  }

  return null;
}

function parseProgrammeTime(value){
  const match=String(value||"").match(/(\d{1,2}):(\d{2})/);
  if(!match)return null;
  const hour=Number(match[1]);
  const minute=Number(match[2]);
  if(hour>23||minute>59)return null;
  return{hour,minute};
}

function programmeStamp(dateValue,timeValue){
  const date=parseProgrammeDate(dateValue);
  const time=parseProgrammeTime(timeValue);
  if(!date||!time)return null;
  return Date.UTC(date.year,date.month-1,date.day,time.hour,time.minute,0,0);
}

function parisNowStamp(){
  try{
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Europe/Paris",
      year:"numeric",
      month:"2-digit",
      day:"2-digit",
      hour:"2-digit",
      minute:"2-digit",
      hourCycle:"h23"
    }).formatToParts(new Date());

    const pick=type=>Number(parts.find(part=>part.type===type)?.value||0);
    return Date.UTC(
      pick("year"),
      pick("month")-1,
      pick("day"),
      pick("hour"),
      pick("minute"),
      0,
      0
    );
  }catch(error){
    const now=new Date();
    return Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      0,
      0
    );
  }
}

function scheduledProgramSlots(){
  const rows=Array.isArray(editorialData.programme)?editorialData.programme:[];

  const slots=rows
    .map(item=>{
      const program=getProgramById(item?.program);
      const start=programmeStamp(item?.date,item?.time);
      return program&&start!==null?{item,program,start}:null;
    })
    .filter(Boolean)
    .sort((a,b)=>a.start-b.start);

  return slots.map((slot,index)=>{
    const {item,start}=slot;
    let end=null;

    if(item.end_time){
      end=programmeStamp(item.date,item.end_time);
      if(end!==null&&end<=start)end+=24*60*60*1000;
    }

    if(end===null&&Number(item.duration_minutes)>0){
      end=start+(Number(item.duration_minutes)*60*1000);
    }

    if(end===null){
      const next=slots[index+1];
      const sixHours=6*60*60*1000;
      end=next&&next.start>start&&next.start-start<=sixHours
        ?next.start
        :start+(60*60*1000);
    }

    return{...slot,end};
  });
}

function getCurrentProgram(){
  const fallback=getDefaultProgram();
  const now=parisNowStamp();
  const current=scheduledProgramSlots()
    .filter(slot=>now>=slot.start&&now<slot.end)
    .pop();

  return current?.program||fallback||null;
}

function currentProgramLabel(program){
  if(!program)return"";
  if(program.now_label)return String(program.now_label);
  return `${program.title||program.id||"program"}${program.featured?" rotation":""}`;
}

function updateCurrentProgramStatus(){
  if(!currentProgramStatus||!currentProgramName)return;
  const program=getCurrentProgram();
  if(!program){
    currentProgramStatus.hidden=true;
    return;
  }

  currentProgramName.textContent=currentProgramLabel(program);
  currentProgramStatus.hidden=false;
}

setInterval(updateCurrentProgramStatus,30*1000);

function updateProgramsTrigger(){
  if(!programsTrigger)return;

  const featured=getDefaultProgram();
  programsTrigger.textContent=featured?.title
    ?`programs — ${featured.title}`
    :"programs";
}

function programTrackMarkup(track,index){
  const artist=escapeHTML(track?.artist||"");
  const title=escapeHTML(track?.title||"");
  const url=String(track?.url||"").trim();
  const content=`
    <span class="program-track-number">${String(index+1).padStart(2,"0")}</span>
    <span class="program-track-copy">
      <span class="program-track-title">${title}</span>
      ${artist?`<span class="program-track-artist"> — ${artist}</span>`:""}
    </span>
  `;

  return url
    ?`<a class="program-track" href="${escapeHTML(url)}" target="_blank" rel="noopener noreferrer">${content}</a>`
    :`<div class="program-track">${content}</div>`;
}

function renderPrograms(){
  if(!programsList)return;

  const programs=activePrograms();

  if(!programs.length){
    programsList.innerHTML='<div class="page-empty">no programs yet</div>';
    return;
  }

  programsList.innerHTML=programs.map((program,index)=>{
    const tracks=Array.isArray(program.tracks)?program.tracks:[];
    const meta=[
      program.featured?"main rotation":"",
      program.update_label||"",
      program.last_updated?`last updated ${program.last_updated}`:""
    ].filter(Boolean).join(" · ");

    return `
      <article class="program-entry${program.featured?" is-featured":""}">
        <div class="program-index">${String(index+1).padStart(2,"0")}</div>
        <div class="program-body">
          <h3 class="program-name">${escapeHTML(program.title||program.id||"")}</h3>
          ${program.description?`<p class="program-description">${escapeHTML(program.description)}</p>`:""}
          ${meta?`<div class="program-meta">${escapeHTML(meta)}</div>`:""}
          ${tracks.length?`<div class="program-tracks">${tracks.map(programTrackMarkup).join("")}</div>`:""}
        </div>
      </article>
    `;
  }).join("");
}

function renderProgramme(){
  if(!programmeList)return;

  const items=Array.isArray(editorialData.programme)
    ?editorialData.programme
    :[];

  if(!items.length){
    const fallback=getDefaultProgram();

    programmeList.innerHTML=fallback
      ?`
        <div class="programme-empty programme-default">
          <span>otherwise</span>
          <span>${escapeHTML(fallback.title||"")}${fallback.update_label?` · ${escapeHTML(fallback.update_label)}`:""}</span>
        </div>
      `
      :`
        <div class="programme-empty">
          <span>nothing scheduled rn</span>
          <span>radio keeps playing all day</span>
        </div>
      `;
    return;
  }

  programmeList.innerHTML=items
    .map(item=>{
      const linkedProgram=item.program?getProgramById(item.program):null;
      const title=linkedProgram?.title||item.title||"";
      const programMeta=linkedProgram?.update_label||"";
      const note=item.note||programMeta;

      return `
        <article class="programme-row"${linkedProgram?` data-program-id="${escapeHTML(linkedProgram.id)}"`:""}>
          <time class="programme-date">${escapeHTML(item.date||"")}</time>

          <div class="programme-time">
            ${escapeHTML(item.time||"")}
          </div>

          <div class="programme-title">
            ${escapeHTML(title)}
            ${note?`<span class="programme-note">${escapeHTML(note)}</span>`:""}
          </div>
        </article>
      `;
    })
    .join("");
}


function splitTrack(text){
  const clean=String(text||"").replace(/\s+/g," ").trim();
  const marker=" - ";
  const index=clean.indexOf(marker);

  if(index===-1){
    return{artist:"",title:clean};
  }

  return{
    artist:clean.slice(0,index).trim(),
    title:clean.slice(index+marker.length).trim()
  };
}

function normalizeText(value){
  return String(value||"")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .replace(/&/g," and ")
    .replace(/\b(feat|ft|featuring)\b.*$/i,"")
    .replace(/\([^)]*\)/g," ")
    .replace(/\[[^\]]*\]/g," ")
    .replace(/[^a-z0-9]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function fuzzyMatch(a,b){
  const x=normalizeText(a);
  const y=normalizeText(b);

  if(!x||!y)return 0;
  if(x===y)return 5;
  if(x.includes(y)||y.includes(x))return 3;

  const xs=new Set(x.split(" "));
  const ys=new Set(y.split(" "));
  const common=[...xs].filter(word=>ys.has(word)).length;
  const denom=Math.max(xs.size,ys.size);

  return denom?(common/denom)*3:0;
}

function setPlayerState(state){
  player.dataset.state=state;
  audioStatus.textContent=state;

  player.classList.toggle(
    "is-playing",
    state==="playing"
  );

  const isPlaying=state==="playing";

  [
    playButton,
    miniPlayButton,
    listeningPlayButton,
    landscapePlayButton
  ].filter(Boolean).forEach(button=>{
    button.classList.toggle("is-playing",isPlaying);

    button.setAttribute(
      "aria-label",
      isPlaying
        ?"Pause care radio"
        :"Play care radio"
    );
  });

  if("mediaSession" in navigator){
    try{
      navigator.mediaSession.playbackState=
        state==="playing"
          ?"playing"
          :"paused";
    }catch(error){}
  }
}


function showStreamMessage(message){
  if(!streamMessage)return;
  streamMessage.textContent=message;
  streamMessage.hidden=false;
}

function hideStreamMessage(){
  if(!streamMessage)return;
  streamMessage.hidden=true;
}


/* ---------- PLAYER + RECONNECTION ---------- */

function clearReconnect(){
  if(reconnectTimer){
    clearTimeout(reconnectTimer);
    reconnectTimer=null;
  }

  if(stallTimer){
    clearTimeout(stallTimer);
    stallTimer=null;
  }
}

function scheduleReconnect(reason="stream interrupted",immediate=false){
  if(!userWantsPlayback)return;

  clearReconnect();

  if(!navigator.onLine){
    setPlayerState("offline");
    showStreamMessage("radio is having a little moment");
    return;
  }

  reconnectAttempts+=1;

  if(reconnectAttempts>=3){
    showStreamMessage("radio is having a little moment");
  }else{
    showStreamMessage("coming back");
  }

  const delay=immediate
    ?0
    :Math.min(
      12000,
      1400*Math.pow(1.7,Math.min(reconnectAttempts-1,5))
    );

  setPlayerState("reconnecting");

  reconnectTimer=setTimeout(async()=>{
    reconnectTimer=null;

    if(!userWantsPlayback)return;

    try{
      audio.pause();
      audio.src=STREAM_URL;
      audio.load();

      await audio.play();
    }catch(error){
      scheduleReconnect(reason,false);
    }
  },delay);
}

async function startRadio(){
  userWantsPlayback=true;
  clearReconnect();

  try{
    setPlayerState("buffering");
    await audio.play();
  }catch(error){
    scheduleReconnect("play failed",false);
  }
}

function stopRadio(){
  userWantsPlayback=false;
  clearReconnect();
  audio.pause();
  setPlayerState("paused");
}

playButton.addEventListener("click",()=>{
  if(userWantsPlayback){
    stopRadio();
  }else{
    startRadio();
  }
});

[
  miniPlayButton,
  listeningPlayButton,
  landscapePlayButton
].filter(Boolean).forEach(button=>{
  button.addEventListener("click",()=>{
    if(userWantsPlayback){
      stopRadio();
    }else{
      startRadio();
    }
  });
});

audio.addEventListener("playing",()=>{
  reconnectAttempts=0;
  clearReconnect();
  hideStreamMessage();
  setPlayerState("playing");
});

audio.addEventListener("waiting",()=>{
  if(!userWantsPlayback)return;

  setPlayerState("buffering");

  clearTimeout(stallTimer);
  stallTimer=setTimeout(()=>{
    scheduleReconnect("buffering too long",true);
  },7000);
});

audio.addEventListener("stalled",()=>{
  if(userWantsPlayback){
    scheduleReconnect("stream stalled",false);
  }
});

audio.addEventListener("error",()=>{
  if(userWantsPlayback){
    scheduleReconnect("stream error",false);
  }else{
    setPlayerState("paused");
  }
});

audio.addEventListener("ended",()=>{
  if(userWantsPlayback){
    scheduleReconnect("stream ended",true);
  }
});

audio.addEventListener("pause",()=>{
  if(!userWantsPlayback){
    setPlayerState("paused");
  }
});

window.addEventListener("offline",()=>{
  if(userWantsPlayback){
    clearReconnect();
    setPlayerState("offline");
    showStreamMessage("radio is having a little moment");
  }
});

window.addEventListener("online",()=>{
  if(userWantsPlayback){
    scheduleReconnect("back online",true);
  }
});

document.addEventListener("visibilitychange",()=>{
  if(
    document.visibilityState==="visible" &&
    userWantsPlayback &&
    audio.paused
  ){
    scheduleReconnect("page resumed",true);
  }
});


/* ---------- MEDIA SESSION / LOCK SCREEN ---------- */

function updateMediaSession(){
  if(
    !("mediaSession" in navigator) ||
    !("MediaMetadata" in window) ||
    !currentTrack.title
  ){
    return;
  }

  const artwork=currentTrack.artwork
    ?[
      {src:currentTrack.artwork,sizes:"96x96"},
      {src:currentTrack.artwork,sizes:"192x192"},
      {src:currentTrack.artwork,sizes:"512x512"}
    ]
    :[
      {src:"/icon-512.png",sizes:"512x512",type:"image/png"}
    ];

  try{
    navigator.mediaSession.metadata=new MediaMetadata({
      title:currentTrack.title,
      artist:currentTrack.artist||"care radio",
      album:currentTrack.album||"care radio",
      artwork
    });
  }catch(error){}
}

if("mediaSession" in navigator){
  try{
    navigator.mediaSession.setActionHandler("play",()=>startRadio());
    navigator.mediaSession.setActionHandler("pause",()=>stopRadio());
  }catch(error){}
}


/* ---------- HD ARTWORK ---------- */

function appleScore(result,artist,title){
  return(
    fuzzyMatch(result.artistName,artist)+
    fuzzyMatch(result.trackName,title)*1.35
  );
}

function deezerScore(result,artist,title){
  return(
    fuzzyMatch(result?.artist?.name,artist)+
    fuzzyMatch(result?.title,title)*1.35
  );
}

function appleHD(url){
  if(!url)return "";

  return String(url)
    .replace(
      /\/\d+x\d+bb(?=[\.\-])/i,
      "/1200x1200bb"
    )
    .replace(
      /\.\d+x\d+(?:-\d+)?(?=\.(?:jpg|jpeg|png|webp)(?:\?|$))/i,
      ".1200x1200-90"
    )
    .replace(/^http:\/\//i,"https://");
}

function showCover(url,sourceName,requestId){
  return new Promise((resolve,reject)=>{
    if(!url){
      reject(new Error("no artwork url"));
      return;
    }

    const image=new Image();
    image.decoding="async";

    image.onload=()=>{
      if(requestId!==artworkRequestId){
        resolve(false);
        return;
      }

      cover.style.opacity="0";

      requestAnimationFrame(()=>{
        cover.src=url;
        cover.dataset.artworkSource=sourceName;
        cover.style.display="block";
        cover.alt=`${currentTrack.artist} — ${currentTrack.title}`;

        currentTrack.artwork=url;

        if(listeningCover){
          listeningCover.src=url;
          listeningCover.alt=`${currentTrack.artist} — ${currentTrack.title}`;
        }

        if(landscapeCover){
          landscapeCover.src=url;
          landscapeCover.alt=`${currentTrack.artist} — ${currentTrack.title}`;
        }

        updateMediaSession();

        requestAnimationFrame(()=>{
          cover.style.opacity="1";
        });
      });

      resolve(true);
    };

    image.onerror=()=>reject(new Error("artwork load failed"));
    image.src=url;
  });
}

async function findAppleArtwork(artist,title){
  const q=encodeURIComponent(`${artist} ${title}`);

  const response=await fetch(
    `/itunes/search?term=${q}&media=music&entity=song&limit=25`,
    {cache:"no-store"}
  );

  if(!response.ok){
    throw new Error("apple search unavailable");
  }

  const data=await response.json();

  const ranked=(data.results||[])
    .filter(item=>item.artworkUrl100)
    .map(item=>({
      item,
      score:appleScore(item,artist,title)
    }))
    .sort((a,b)=>b.score-a.score);

  if(!ranked.length||ranked[0].score<6.2){
    throw new Error("no confident apple match");
  }

  return appleHD(ranked[0].item.artworkUrl100);
}

async function findDeezerArtwork(artist,title){
  const query=encodeURIComponent(
    `artist:"${artist}" track:"${title}"`
  );

  const response=await fetch(
    `/deezer/search?q=${query}&limit=25`,
    {cache:"no-store"}
  );

  if(!response.ok){
    throw new Error("deezer search unavailable");
  }

  const data=await response.json();

  const ranked=(data.data||[])
    .filter(item=>item?.album?.cover_xl||item?.album?.cover_big)
    .map(item=>({
      item,
      score:deezerScore(item,artist,title)
    }))
    .sort((a,b)=>b.score-a.score);

  if(!ranked.length||ranked[0].score<6.2){
    throw new Error("no confident deezer match");
  }

  return(
    ranked[0].item.album.cover_xl||
    ranked[0].item.album.cover_big
  ).replace(/^http:\/\//i,"https://");
}

async function updateArtwork(artist,title){
  const cleanArtist=String(artist||"").trim();
  const cleanTitle=String(title||"").trim();

  if(!cleanArtist||!cleanTitle)return;

  const artworkKey=
    `${normalizeText(cleanArtist)}::${normalizeText(cleanTitle)}`;

  if(artworkKey===lastArtworkKey){
    return;
  }

  lastArtworkKey=artworkKey;
  const requestId=++artworkRequestId;

  try{
    const appleUrl=await findAppleArtwork(cleanArtist,cleanTitle);

    if(requestId!==artworkRequestId)return;

    await showCover(appleUrl,"apple",requestId);
    return;
  }catch(error){}

  try{
    const deezerUrl=await findDeezerArtwork(cleanArtist,cleanTitle);

    if(requestId!==artworkRequestId)return;

    await showCover(deezerUrl,"deezer",requestId);
    return;
  }catch(error){}

  const fallback=
    document.getElementById("fastCoverSource")?.src||"";

  if(fallback&&requestId===artworkRequestId){
    try{
      await showCover(
        fallback,
        "fastcast-fallback",
        requestId
      );
    }catch(error){}
  }
}


/* ---------- CURRENT TRACK + TRANSITIONS ---------- */

function applyCurrentTrack(artist,title,album){
  const key=
    `${normalizeText(artist)}::${normalizeText(title)}`;

  if(key===currentTrackKey){
    if(album&&album!==currentTrack.album){
      currentTrack.album=album;
      document.getElementById("trackAlbum").textContent=album;
      updateMediaSession();
    }
    return;
  }

  const firstTrack=!currentTrackKey;

  const commit=()=>{
    currentTrackKey=key;
    currentTrack={
      artist,
      title,
      album,
      artwork:""
    };

    document.getElementById("trackTitle").textContent=title;
    document.getElementById("trackArtist").textContent=artist;
    document.getElementById("trackAlbum").textContent=album||"";

    miniArtist.textContent=artist;
    miniTitle.textContent=title;

    listeningTitle.textContent=title;
    listeningArtist.textContent=artist;

    landscapeTitle.textContent=title;
    landscapeArtist.textContent=artist;

    document.title=`${title} — ${artist} | care radio`;

    nowCard.classList.remove("is-loading","is-updating");
    nowCard.classList.add("is-ready");

    if(!firstTrack){
      nowCard.classList.remove("track-change");
      document.body.classList.remove("track-change-active");

      void nowCard.offsetWidth;

      nowCard.classList.add("track-change");
      document.body.classList.add("track-change-active");

      setTimeout(()=>{
        nowCard.classList.remove("track-change");
        document.body.classList.remove("track-change-active");
      },560);
    }

    updateMiniPlayerVisibility();

    recordHeardTrack({
      artist,
      title
    });

    updateMediaSession();
    updateArtwork(artist,title);
  };

  if(firstTrack){
    commit();
  }else{
    nowCard.classList.add("is-updating");

    setTimeout(()=>{
      commit();
    },150);
  }
}

function renderCurrent(){
  clearTimeout(renderCurrentTimer);

  renderCurrentTimer=setTimeout(()=>{
    const artist=
      document.getElementById("trackArtistSource")
        .textContent
        .trim();

    const title=
      document.getElementById("trackTitleSource")
        .textContent
        .trim();

    const album=
      document.getElementById("albumSource")
        .textContent
        .trim();

    if(
      !artist||
      !title||
      /loading/i.test(artist)||
      /loading/i.test(title)
    ){
      return;
    }

    applyCurrentTrack(
      artist,
      title,
      album&&!/loading/i.test(album)
        ?album
        :""
    );
  },90);
}

const currentObserver=new MutationObserver(renderCurrent);

[
  "trackArtistSource",
  "trackTitleSource",
  "albumSource"
].forEach(id=>{
  currentObserver.observe(
    document.getElementById(id),
    {
      childList:true,
      subtree:true,
      characterData:true
    }
  );
});

renderCurrent();


/* ---------- RECENT TRACKS / SMART TICKER ---------- */

function recentItemsHTML(tracks){
  return tracks.map(track=>`
    <span class="recent-item">
      <span class="recent-title">${escapeHTML(track.title)}</span>
      <span class="recent-artist">— ${escapeHTML(track.artist)}</span>
    </span>
  `).join('<span class="recent-sep">///</span>');
}

function renderRecentTracks(){
  if(!recentTracksCache.length)return;

  recent.classList.remove("is-moving");
  recent.style.removeProperty("--ticker-distance");
  recent.style.removeProperty("--ticker-duration");

  const items=recentItemsHTML(recentTracksCache);

  recent.innerHTML=`
    <span class="ticker-set ticker-primary">${items}</span>
  `;

  recentShell.classList.remove("is-loading");
  recentShell.classList.add("is-ready");

  const mobile=window.matchMedia("(max-width:760px)").matches;

  requestAnimationFrame(()=>{
    const primary=recent.querySelector(".ticker-primary");
    if(!primary)return;

    const primaryWidth=primary.scrollWidth;
    const viewportWidth=recentViewport.clientWidth;

    /* Desktop stays still when everything fits.
       Mobile keeps the moving ticker as a signature element. */
    if(!mobile && primaryWidth<=viewportWidth*.94){
      return;
    }

    const separator=document.createElement("span");
    separator.className="recent-sep ticker-loop-sep";
    separator.textContent="///";

    const clone=primary.cloneNode(true);
    clone.classList.remove("ticker-primary");
    clone.classList.add("ticker-clone");
    clone.setAttribute("aria-hidden","true");

    recent.append(separator,clone);

    const separatorWidth=separator.getBoundingClientRect().width;
    const distance=primaryWidth+separatorWidth;

    recent.style.setProperty(
      "--ticker-distance",
      `${distance}px`
    );

    const pixelsPerSecond = mobile ? 17 : 28;

    recent.style.setProperty(
      "--ticker-duration",
      `${Math.max(mobile ? 30 : 20, distance/pixelsPerSecond)}s`
    );

    recent.classList.add("is-moving");
  });
}

async function updateRecent(){
  try{
    const response=await fetch(
      FEED,
      {cache:"no-store"}
    );

    if(!response.ok){
      throw new Error();
    }

    const html=await response.text();

    const doc=new DOMParser().parseFromString(
      html,
      "text/html"
    );

    const tracks=[...doc.querySelectorAll("a")]
      .map(a=>a.textContent.trim())
      .filter(Boolean)
      .filter(text=>text.includes(" - "))
      .map(splitTrack)
      .slice(1,51);

    if(!tracks.length){
      throw new Error();
    }

    historyTracksCache=tracks;
    recentTracksCache=tracks.slice(0,3);
    renderRecentTracks();
    renderHistory();

  }catch(error){
    /* Keep the last successful list instead of flashing an error. */
    if(recentTracksCache.length){
      renderRecentTracks();
    }
  }
}

updateRecent();
setInterval(updateRecent,20000);

window.addEventListener("resize",()=>{
  clearTimeout(resizeTimer);

  resizeTimer=setTimeout(()=>{
    renderRecentTracks();
  },140);
});


/* ---------- COVER FALLBACK ---------- */

cover.addEventListener("error",()=>{
  const fallback=
    document.getElementById("fastCoverSource")?.src||"";

  if(
    fallback&&
    cover.dataset.artworkSource!=="fastcast-fallback"
  ){
    cover.dataset.artworkSource="fastcast-fallback";
    cover.src=fallback;
    cover.style.display="block";
    cover.style.opacity="1";

    currentTrack.artwork=fallback;

    if(listeningCover)listeningCover.src=fallback;
    if(landscapeCover)landscapeCover.src=fallback;

    updateMediaSession();
    return;
  }

  const wrap=document.querySelector(".cover-wrap");

  if(wrap){
    wrap.style.display="none";
  }

  nowCard.style.gridTemplateColumns="1fr";
});


/* ---------- OVERLAYS ---------- */

let lastOverlayTrigger=null;

function openOverlay(overlay,trigger=null){
  if(!overlay)return;

  lastOverlayTrigger=trigger||document.activeElement;
  overlay.hidden=false;
  document.body.classList.add("overlay-open");

  requestAnimationFrame(()=>{
    const close=overlay.querySelector("[data-close-overlay]");
    if(close)close.focus();
  });
}

function closeOverlay(overlay){
  if(!overlay)return;

  overlay.hidden=true;

  const anyOpen=[
    historyOverlay,
    notesOverlay,
    heardOverlay,
    submitOverlay,
    programsOverlay,
    listeningOverlay
  ].some(item=>item&&!item.hidden);

  if(!anyOpen){
    document.body.classList.remove("overlay-open");
  }

  if(lastOverlayTrigger&&typeof lastOverlayTrigger.focus==="function"){
    lastOverlayTrigger.focus();
  }
}

document.querySelectorAll("[data-close-overlay]").forEach(button=>{
  button.addEventListener("click",()=>{
    closeOverlay(button.closest(".overlay"));
  });
});

[historyOverlay,notesOverlay,heardOverlay,submitOverlay,programsOverlay,listeningOverlay].forEach(overlay=>{
  if(!overlay)return;

  overlay.addEventListener("click",event=>{
    if(event.target===overlay){
      closeOverlay(overlay);
    }
  });
});

document.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
    [historyOverlay,notesOverlay,heardOverlay,submitOverlay,programsOverlay,listeningOverlay].forEach(overlay=>{
      if(overlay&&!overlay.hidden){
        closeOverlay(overlay);
      }
    });

    shareMenu.hidden=true;
  }
});


/* ---------- MOBILE SWIPE-DOWN TO CLOSE ---------- */

function enableSwipeToClose(overlay){
  if(!overlay)return;

  let startY=0;
  let currentY=0;
  let active=false;

  overlay.addEventListener("touchstart",event=>{
    if(!window.matchMedia("(max-width:760px)").matches)return;
    if(overlay.scrollTop>1)return;
    if(event.touches.length!==1)return;

    if(
      event.target.closest(
        "input, textarea, select, option, button, a"
      )
    ){
      return;
    }

    startY=event.touches[0].clientY;
    currentY=startY;
    active=true;
  },{passive:true});

  overlay.addEventListener("touchmove",event=>{
    if(!active||event.touches.length!==1)return;

    currentY=event.touches[0].clientY;
    const delta=currentY-startY;

    if(delta<=0)return;

    const translated=Math.min(delta*.72,180);

    overlay.classList.add("swipe-dragging");
    overlay.style.transform=`translateY(${translated}px)`;
  },{passive:true});

  overlay.addEventListener("touchend",()=>{
    if(!active)return;
    active=false;

    const delta=currentY-startY;

    overlay.classList.remove("swipe-dragging");

    if(delta>90){
      overlay.style.transform="";
      closeOverlay(overlay);
      return;
    }

    overlay.classList.add("swipe-return");
    overlay.style.transform="translateY(0)";

    setTimeout(()=>{
      overlay.classList.remove("swipe-return");
      overlay.style.transform="";
    },220);
  });
}

[
  historyOverlay,
  notesOverlay,
  heardOverlay,
  submitOverlay,
  programsOverlay,
  listeningOverlay
].forEach(enableSwipeToClose);


/* ---------- RECENT HISTORY ---------- */

function renderHistory(){
  if(!historyList||!historyTracksCache.length)return;

  historyList.innerHTML=historyTracksCache
    .map((track,index)=>`
      <article class="history-item">
        <div class="history-number">${String(index+1).padStart(2,"0")}</div>
        <div class="history-track">
          <div class="history-title">${escapeHTML(track.title)}</div>
          <div class="history-artist">${escapeHTML(track.artist)}</div>
        </div>
      </article>
    `)
    .join("");
}

function openHistory(){
  renderHistory();
  openOverlay(historyOverlay,recentShell);
}

recentShell.addEventListener("click",openHistory);
recentShell.addEventListener("keydown",event=>{
  if(event.key==="Enter"||event.key===" "){
    event.preventDefault();
    openHistory();
  }
});


/* ---------- SUBMIT MUSIC / CLOUDFLARE D1 ---------- */

submitMusic.addEventListener("click",event=>{
  event.preventDefault();
  submitStatus.textContent="";
  openOverlay(submitOverlay,submitMusic);
});

musicSubmitForm.addEventListener("submit",async event=>{
  event.preventDefault();

  if(!musicSubmitForm.reportValidity()){
    return;
  }

  const button=musicSubmitForm.querySelector(".form-submit");
  button.disabled=true;
  button.textContent="sending";
  submitStatus.textContent="";

  try{
    const formData=new FormData(musicSubmitForm);

    const response=await fetch("/api/submit",{
      method:"POST",
      headers:{
        "Content-Type":"application/x-www-form-urlencoded"
      },
      body:new URLSearchParams(formData).toString()
    });

    if(!response.ok){
      throw new Error("submission failed");
    }

    musicSubmitForm.reset();
    button.textContent="sent <3";
    submitStatus.textContent="got it. thank u.";

    setTimeout(()=>{
      button.textContent="send it";
      button.disabled=false;
    },2600);

  }catch(error){
    button.textContent="try again";
    button.disabled=false;
    submitStatus.textContent="didn’t go through. try once more.";
  }
});


/* ---------- PROGRAMS ---------- */

programsTrigger?.addEventListener("click",()=>{
  renderPrograms();
  openOverlay(programsOverlay,programsTrigger);
});


/* ---------- SHARE CURRENT TRACK ---------- */

function shareText(){
  const artist=currentTrack.artist||"";
  const title=currentTrack.title||"care radio";

  return{
    title:`${title} — ${artist}`,
    text:artist
      ?`${artist} — ${title} on care_radi0`
      :`${title} on care_radi0`,
    url:`${window.location.origin}/`
  };
}

function openShareMenu(trigger){
  if(!currentTrack.title)return;

  shareCurrent.innerHTML=`
    <strong>${escapeHTML(currentTrack.title)}</strong>
    <span>${escapeHTML(currentTrack.artist)}</span>
  `;

  shareFeedback.textContent="";
  shareMenu.hidden=false;

  requestAnimationFrame(()=>{
    shareTrackButton.focus();
  });
}

function openListeningMode(trigger){

  if(!currentTrack.title)return;

  listeningTitle.textContent=currentTrack.title;
  listeningArtist.textContent=currentTrack.artist;

  if(currentTrack.artwork){
    listeningCover.src=currentTrack.artwork;
  }

  openOverlay(listeningOverlay,trigger);
}


document.querySelectorAll(".share-trigger").forEach(trigger=>{

  const activate=()=>{

    const isListeningTrigger=
      trigger.classList.contains("cover-wrap") ||
      trigger.classList.contains("listening-trigger");

    if(isListeningTrigger){
      openListeningMode(trigger);
    }else{
      openShareMenu(trigger);
    }

  };  // ← c'est ça qui manquait


  trigger.addEventListener("click",activate);


  trigger.addEventListener("keydown",event=>{

    if(event.key==="Enter" || event.key===" "){

      event.preventDefault();
      activate();

    }

  });

});

shareTrackButton.addEventListener("click",async()=>{
  const payload=shareText();

  try{
    if(navigator.share){
      await navigator.share(payload);
      shareMenu.hidden=true;
      return;
    }

    await navigator.clipboard.writeText(
      `${payload.text}\n${payload.url}`
    );

    shareFeedback.textContent="copied 4 later";
  }catch(error){
    if(error?.name!=="AbortError"){
      shareFeedback.textContent="sharing had a moment";
    }
  }
});

copyTrackButton.addEventListener("click",async()=>{
  const payload=shareText();
  const value=`${payload.text}\n${payload.url}`;

  try{
    await navigator.clipboard.writeText(value);
    shareFeedback.textContent="copied 4 later";
  }catch(error){
    const textarea=document.createElement("textarea");
    textarea.value=value;
    textarea.setAttribute("readonly","");
    textarea.style.position="fixed";
    textarea.style.opacity="0";
    document.body.appendChild(textarea);
    textarea.select();

    try{
      document.execCommand("copy");
      shareFeedback.textContent="copied 4 later";
    }catch(copyError){
      shareFeedback.textContent="copy had a moment";
    }

    textarea.remove();
  }
});

document.addEventListener("pointerdown",event=>{
  if(
    !shareMenu.hidden &&
    !shareMenu.contains(event.target) &&
    !event.target.closest(".share-trigger")
  ){
    shareMenu.hidden=true;
  }
});


/* ---------- MOBILE STICKY PLAYER ---------- */

function updateMiniPlayerVisibility(){
  const mobile=window.matchMedia("(max-width:760px)").matches;
  const hasTrack=Boolean(currentTrack.title);

  const shouldShow=
    mobile && !playerIsInView && hasTrack;

  miniPlayer.classList.toggle("is-visible",shouldShow);
  document.body.classList.toggle("mini-visible",shouldShow);

  miniPlayer.setAttribute(
    "aria-hidden",
    shouldShow ? "false" : "true"
  );
}

const playerObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
    playerIsInView=entry.isIntersecting;
    updateMiniPlayerVisibility();
  }
},{
  threshold:.2
});

playerObserver.observe(document.querySelector(".player-wrap"));

window.addEventListener("resize",updateMiniPlayerVisibility);


/* ---------- LOGO ---------- */

/* The logo is intentionally static. Its color is defined in CSS. */


/* ---------- LISTENING TIME MICROCOPY ---------- */

function showListenNote(message){
  if(!listenNote)return;

  clearTimeout(listenNoteTimer);

  listenNote.textContent=message;
  listenNote.hidden=false;
  listenNote.classList.remove("is-leaving");

  listenNoteTimer=setTimeout(()=>{
    listenNote.classList.add("is-leaving");

    setTimeout(()=>{
      listenNote.hidden=true;
      listenNote.classList.remove("is-leaving");
    },240);
  },6500);
}

setInterval(()=>{
  if(player.dataset.state!=="playing")return;

  listeningSeconds+=1;

  if(
    listeningSeconds>=600 &&
    !listeningMilestones.has(600)
  ){
    listeningMilestones.add(600);
    showListenNote("u stayed for 10 min");
  }

  if(
    listeningSeconds>=1800 &&
    !listeningMilestones.has(1800)
  ){
    listeningMilestones.add(1800);
    showListenNote("still here <3");
  }

  if(
    listeningSeconds>=3600 &&
    !listeningMilestones.has(3600)
  ){
    listeningMilestones.add(3600);
    showListenNote("pls stay for the whole song");
  }
},1000);



/* ============================================================
   NOTES + HEARD PAGES
============================================================ */

function renderNotes(){
  if(!notesList)return;

  const notes=Array.isArray(editorialData.notes)
    ?editorialData.notes
    :[];

  if(!notes.length){
    notesList.innerHTML=`
      <div class="page-empty">
        no notes yet
      </div>
    `;
    return;
  }

  notesList.innerHTML=notes
    .map(note=>`
      <article class="note-entry">
        <div class="note-date">
          ${escapeHTML(note.date||"")}
        </div>

        <div class="note-text">
          ${escapeHTML(note.text||"")}
        </div>
      </article>
    `)
    .join("");
}

function openNotes(trigger=terminalTrigger){
  renderNotes();
  openOverlay(notesOverlay,trigger);
}


/* ---------- HEARD MEMORY ---------- */

const HEARD_STORAGE_KEY="care_radi0_heard_v1";

function loadHeardTracks(){
  try{
    const stored=JSON.parse(
      localStorage.getItem(HEARD_STORAGE_KEY) || "[]"
    );

    return Array.isArray(stored) ? stored : [];
  }catch(error){
    return [];
  }
}

function saveHeardTracks(tracks){
  try{
    localStorage.setItem(
      HEARD_STORAGE_KEY,
      JSON.stringify(tracks)
    );
  }catch(error){}
}

function heardTrackKey(track){
  return(
    normalizeText(track.artist)
    +"::"+
    normalizeText(track.title)
  );
}

function recordHeardTrack(track){
  if(!track || !track.artist || !track.title){
    return;
  }

  let heard=loadHeardTracks();
  const key=heardTrackKey(track);
  const existingIndex=heard.findIndex(item=>item.key===key);

  if(existingIndex!==-1){
    const existing=heard.splice(existingIndex,1)[0];

    existing.count=(existing.count||1)+1;
    existing.lastHeard=Date.now();

    heard.push(existing);
  }else{
    heard.push({
      key,
      artist:track.artist,
      title:track.title,
      count:1,
      firstHeard:Date.now(),
      lastHeard:Date.now()
    });
  }

  /* Keep local browser memory finite. */
  saveHeardTracks(heard.slice(-300));
}

function formatHeardDate(timestamp){
  const date=new Date(Number(timestamp));

  if(Number.isNaN(date.getTime())){
    return "";
  }

  const pad=value=>String(value).padStart(2,"0");

  return(
    `${pad(date.getDate())}.`
    +`${pad(date.getMonth()+1)}.`
    +`${String(date.getFullYear()).slice(-2)}`
    +` · ${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

function renderHeard(){
  if(!heardList)return;

  const heard=loadHeardTracks()
    .slice()
    .reverse();

  if(!heard.length){
    heardList.innerHTML=`
      <div class="page-empty">
        nothing heard here yet
      </div>
    `;
    return;
  }

  heardList.innerHTML=heard
    .map((track,index)=>{
      const meta=[
        formatHeardDate(track.lastHeard),
        track.count>1 ? `×${track.count}` : ""
      ].filter(Boolean).join(" · ");

      return `
        <article class="heard-item">
          <div class="heard-number">
            ${String(index+1).padStart(2,"0")}
          </div>

          <div class="heard-track">
            <div class="heard-title">
              ${escapeHTML(track.title||"")}
            </div>
            <div class="heard-artist">
              ${escapeHTML(track.artist||"")}
            </div>
          </div>

          <div class="heard-meta">
            ${escapeHTML(meta)}
          </div>
        </article>
      `;
    })
    .join("");
}

function openHeard(trigger=terminalTrigger){
  renderHeard();
  openOverlay(heardOverlay,trigger);
}

/* ============================================================
   CARE RADIO COMMAND
   Desktop terminal + dedicated mobile command screen
============================================================ */

const TERMINAL_ITEMS=[
  ["listen","listen"],
  ["agenda","agenda"],
  ["submit","submit"],
  ["programs","programs"],
  ["notes","notes"],
  ["heard","heard"]
];

const INSTAGRAM_URL="https://instagram.com/care_radi0";

function isPhoneLayout(){
  return window.matchMedia("(max-width:760px)").matches;
}

function commandItemsMarkup(className="terminal-nav"){
  const commands=TERMINAL_ITEMS
    .map(([label,command])=>`
      <button
        type="button"
        data-terminal-command="${command}"
      >${label}</button>
    `)
    .join("");

  return `
    <nav class="${className}" aria-label="care radio menu">
      ${commands}

      <a
        href="${INSTAGRAM_URL}"
        target="_blank"
        rel="noopener noreferrer"
      >instagram</a>
    </nav>
  `;
}

function runNavigationCommand(command,trigger){
  const clean=String(command||"").trim().toLowerCase();

  if(["listen","stay","player"].includes(clean)){
    openListeningMode(trigger);
    return true;
  }

  if(["programme","agenda"].includes(clean)){
    programmeSection?.scrollIntoView({
      behavior:"smooth",
      block:"start"
    });

    return true;
  }

  if(clean==="submit"){
    submitStatus.textContent="";
    openOverlay(submitOverlay,trigger);
    return true;
  }

  if(["programs","program","rotation","rotations"].includes(clean)){
    renderPrograms();
    openOverlay(programsOverlay,trigger);
    return true;
  }

  if(["notes","note"].includes(clean)){
    openNotes(trigger);
    return true;
  }

  if(clean==="heard"){
    openHeard(trigger);
    return true;
  }

  if(["instagram","insta","ig"].includes(clean)){
    window.open(
      INSTAGRAM_URL,
      "_blank",
      "noopener,noreferrer"
    );

    return true;
  }

  if(["home","top"].includes(clean)){
    window.scrollTo({
      top:0,
      behavior:"smooth"
    });

    return true;
  }

  return false;
}


/* ------------------------------------------------------------
   DESKTOP TERMINAL
------------------------------------------------------------ */

function terminalOpen(){
  if(isPhoneLayout()){
    openMobileCommand();
    return;
  }

  terminalLog.innerHTML=commandItemsMarkup();
  terminalDock.hidden=false;

  terminalTrigger.setAttribute(
    "aria-expanded",
    "true"
  );

  requestAnimationFrame(()=>{
    terminalInput.focus();
  });
}

function terminalClose(){
  terminalDock.hidden=true;

  terminalTrigger.setAttribute(
    "aria-expanded",
    "false"
  );

  terminalInput.value="";
  terminalLog.innerHTML="";
}

function terminalLine(content,className=""){
  const line=document.createElement("div");

  line.className=`terminal-line ${className}`.trim();
  line.innerHTML=content;

  terminalLog.appendChild(line);
  terminalDock.scrollTop=terminalDock.scrollHeight;
}

function runTerminalCommand(rawCommand){
  const raw=String(rawCommand||"").trim();

  if(!raw)return;

  terminalLog.innerHTML="";

  const command=raw.toLowerCase();

  if(command==="?" || command==="help"){
    terminalLog.innerHTML=
      commandItemsMarkup("terminal-nav terminal-nav-help");

    return;
  }

  if(runNavigationCommand(command,terminalTrigger)){
    terminalClose();
    return;
  }

  if(["close","exit"].includes(command)){
    terminalClose();
    return;
  }

  terminalLine(
    `don't know “${escapeHTML(raw)}” — try ?`,
    "terminal-muted"
  );
}

terminalLog.addEventListener("click",event=>{
  const button=event.target.closest("[data-terminal-command]");
  if(!button)return;

  event.preventDefault();
  const command=button.dataset.terminalCommand;

  if(runNavigationCommand(command,terminalTrigger)){
    terminalClose();
  }
});

terminalTrigger.addEventListener("click",()=>{
  if(isPhoneLayout()){
    openMobileCommand();
    return;
  }

  terminalDock.hidden
    ?terminalOpen()
    :terminalClose();
});

terminalForm.addEventListener("submit",event=>{
  event.preventDefault();

  const command=terminalInput.value;

  terminalInput.value="";

  runTerminalCommand(command);
});

document.addEventListener("pointerdown",event=>{
  if(isPhoneLayout())return;
  if(terminalDock.hidden)return;

  if(
    terminalDock.contains(event.target) ||
    terminalTrigger.contains(event.target)
  ){
    return;
  }

  terminalClose();
});


/* ------------------------------------------------------------
   MOBILE COMMAND SCREEN
------------------------------------------------------------ */

function ensureMobileCommandUI(){
  const existingScreen=document.getElementById("mobileCommandScreen");
  if(existingScreen)return;

  const hero=document.querySelector(".hero");
  if(!hero)return;

  let trigger=document.getElementById("mobileCommandTrigger");

  if(!trigger){
    trigger=document.createElement("button");
    trigger.id="mobileCommandTrigger";
    trigger.className="mobile-command-trigger";
    trigger.type="button";
    trigger.setAttribute("aria-label","Open care radio menu");
    trigger.setAttribute("aria-controls","mobileCommandScreen");
    trigger.setAttribute("aria-expanded","false");
    trigger.textContent="_";
    hero.appendChild(trigger);
  }

  const screen=document.createElement("section");

  screen.id="mobileCommandScreen";
  screen.className="mobile-command-screen";
  screen.setAttribute("role","dialog");
  screen.setAttribute("aria-modal","true");
  screen.setAttribute("aria-label","care radio command");
  screen.hidden=true;

  screen.innerHTML=`
    <button
      class="mobile-command-close"
      id="mobileCommandClose"
      type="button"
      aria-label="Close command"
    >×</button>

    <div class="mobile-command-title">
      command
    </div>

    <form
      class="mobile-command-search"
      id="mobileCommandForm"
      autocomplete="off"
    >
      <span aria-hidden="true">&gt;</span>

      <input
        id="mobileCommandInput"
        type="text"
        autocapitalize="none"
        autocomplete="off"
        spellcheck="false"
        aria-label="Type a care radio command"
        placeholder="type something"
      >
    </form>

    ${commandItemsMarkup("mobile-command-nav")}

    <div
      class="mobile-command-feedback"
      id="mobileCommandFeedback"
      role="status"
      aria-live="polite"
    ></div>
  `;

  document.body.appendChild(screen);

  const close=document.getElementById("mobileCommandClose");
  const form=document.getElementById("mobileCommandForm");
  const input=document.getElementById("mobileCommandInput");

  trigger.addEventListener("click",openMobileCommand);
  close.addEventListener("click",closeMobileCommand);

  form.addEventListener("submit",event=>{
    event.preventDefault();

    const command=input.value;

    input.value="";

    runMobileCommand(command);
  });

  screen.addEventListener("click",event=>{
    const commandButton=
      event.target.closest("[data-terminal-command]");

    if(commandButton){
      event.preventDefault();
      const command=commandButton.dataset.terminalCommand;

      closeMobileCommand({restoreFocus:false});
      runNavigationCommand(command,trigger);
      return;
    }
  });

  /* A gentle swipe down from the top also closes the screen. */
  let touchStartY=0;

  screen.addEventListener(
    "touchstart",
    event=>{
      if(screen.scrollTop>1)return;
      if(event.touches.length!==1)return;

      touchStartY=
        event.touches[0].clientY;
    },
    {passive:true}
  );

  screen.addEventListener(
    "touchend",
    event=>{
      if(!touchStartY)return;
      if(!event.changedTouches.length)return;

      const delta=
        event.changedTouches[0].clientY
        - touchStartY;

      touchStartY=0;

      if(delta>90){
        closeMobileCommand();
      }
    },
    {passive:true}
  );
}

function mobileCommandElements(){
  return{
    trigger:
      document.getElementById("mobileCommandTrigger"),
    screen:
      document.getElementById("mobileCommandScreen"),
    input:
      document.getElementById("mobileCommandInput"),
    feedback:
      document.getElementById("mobileCommandFeedback")
  };
}

function openMobileCommand(){
  ensureMobileCommandUI();

  const {
    trigger,
    screen,
    input,
    feedback
  }=mobileCommandElements();

  if(!screen)return;

  screen.hidden=false;

  document.body.classList.add(
    "mobile-command-open"
  );

  trigger?.setAttribute(
    "aria-expanded",
    "true"
  );

  if(input){
    input.value="";
  }

  if(feedback){
    feedback.textContent="";
  }

  /*
    Deliberately do NOT focus the search field.
    The menu is fully usable with the thumb without forcing
    the iPhone keyboard onto the screen.
  */
}

function closeMobileCommand({
  restoreFocus=true
}={}){
  const {
    trigger,
    screen,
    input,
    feedback
  }=mobileCommandElements();

  if(!screen)return;

  screen.hidden=true;

  document.body.classList.remove(
    "mobile-command-open"
  );

  trigger?.setAttribute(
    "aria-expanded",
    "false"
  );

  if(input){
    input.value="";
    input.blur();
  }

  if(feedback){
    feedback.textContent="";
  }

  if(
    restoreFocus &&
    trigger &&
    typeof trigger.focus==="function"
  ){
    trigger.focus({
      preventScroll:true
    });
  }
}

function runMobileCommand(rawCommand){
  const raw=String(rawCommand||"").trim();

  if(!raw)return;

  const command=raw.toLowerCase();

  const {
    trigger,
    feedback
  }=mobileCommandElements();

  if(command==="?" || command==="help"){
    if(feedback){
      feedback.textContent=
        "choose one of the links below";
    }

    return;
  }

  closeMobileCommand({
    restoreFocus:false
  });

  if(
    runNavigationCommand(
      command,
      trigger
    )
  ){
    return;
  }

  /* Unknown command: reopen and show the message. */
  openMobileCommand();

  if(feedback){
    feedback.textContent=
      `don't know “${raw}”`;
  }
}

ensureMobileCommandUI();


/* ------------------------------------------------------------
   KEYBOARD
------------------------------------------------------------ */

document.addEventListener("keydown",event=>{
  const typing=
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement;

  if(
    event.key==="/" &&
    !typing &&
    !document.body.classList.contains("overlay-open")
  ){
    event.preventDefault();

    if(isPhoneLayout()){
      openMobileCommand();

      requestAnimationFrame(()=>{
        mobileCommandElements().input?.focus();
      });
    }else if(terminalDock.hidden){
      terminalOpen();
    }

    return;
  }

  if(event.key==="Escape"){
    const mobileScreen=
      document.getElementById("mobileCommandScreen");

    if(
      mobileScreen &&
      !mobileScreen.hidden
    ){
      closeMobileCommand();
      return;
    }

    if(!terminalDock.hidden){
      terminalClose();
    }
  }
});


/* ---------- INITIAL STATE ---------- */

setPlayerState("paused");
