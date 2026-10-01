document.querySelector('#open').onclick = () => chrome.tabs.create({url:chrome.runtime.getURL('dashboard.html')});
document.querySelector('#inspect').onclick = async () => {
  const button=document.querySelector('#inspect'); button.disabled=true;
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    const url=new URL(tab.url); if(!['http:','https:'].includes(url.protocol)) throw new Error('Open an HTTP or HTTPS website first.');
    // Request access only to the website the user selected, during this click gesture.
    const granted=await chrome.permissions.request({origins:[`${url.origin}/*`]});
    const result=await chrome.runtime.sendMessage({type:'inspect',tabId:tab.id,hostAccess:granted});
    if(result.error) throw new Error(result.error);
    await chrome.tabs.create({url:chrome.runtime.getURL(`dashboard.html?id=${result.id}`)});
  } catch(error){document.querySelector('#message').textContent=error.message;} finally{button.disabled=false;}
};
