//-- indexedDB API

function initDB() {  
  window.addEventListener('unhandledrejection', function(event) {
    alert("Error: " + event.reason.message);
  });

  
  let openReq =  indexedDB.open('vc64db', 4);

  openReq.onupgradeneeded = function (event){
      let db = openReq.result;
      switch (event.oldVersion) {
          case 0:
              //no db
              break;
          default:
              break;
      }
      if(!db.objectStoreNames.contains('snapshots'))
      {
         var snapshot_store=db.createObjectStore('snapshots', {keyPath: 'id', autoIncrement: true});
         snapshot_store.createIndex("title", "title", { unique: false });
      }
      if(!db.objectStoreNames.contains('apps'))
      {
         var apps_store=db.createObjectStore('apps', {keyPath: 'title'}); 
      }

      //db.deleteObjectStore('custom_buttons');
      if(!db.objectStoreNames.contains('custom_buttons'))
      {
         //alert("create two local object stores");
         var custom_buttons_store=db.createObjectStore('custom_buttons', {keyPath: 'title'});
      }

  };
  openReq.onerror = function() { console.error("Error", openReq.error);}
  openReq.onsuccess = function() {
      db=openReq.result;
  }  
}


function save_snapshot(the_name, the_data) {
  //beim laden in die drop zone den Titel merken
  //dann beim take snapshot, den titel automatisch mitgeben
  //im Snapshotbrowser jeden titel als eigene row darstellen
  //erste row autosnapshot, danach kommen die Titel
  //extra user snapshot ist dann unnötig
  let the_snapshot = {
    title: the_name,
    data: the_data //,
//    created: new Date()
  };

  let tx_apps = db.transaction('apps', 'readwrite');
  let req_apps = tx_apps.objectStore('apps').put({title: the_name});
  req_apps.onsuccess= function(e){ 
        console.log("wrote app with id="+e.target.result)        
  };


  let tx = db.transaction('snapshots', 'readwrite');
  tx.oncomplete = function() {
    console.log("Transaction is complete");
  };
  tx.onabort = function() {
    console.log("Transaction is aborted");
  };
 
  try {
    let req = tx.objectStore('snapshots').add(the_snapshot);
    req.onsuccess= function(e){ 
        console.log("wrote snapshot with id="+e.target.result)        
    };
    req.onerror = function(e){ 
        console.error("could not write snapshot: ",  req.error) 
    };
  } catch(err) {
    if (err.name == 'ConstraintError') {
      alert("Such snapshot exists already");
    } else {
      throw err;
    }
  }
}

function get_stored_app_titles(callback_fn)
{
    let transaction = db.transaction("apps"); // readonly
    let apps = transaction.objectStore("apps");

    let request = apps.getAllKeys();

    request.onsuccess = function() {
        if (request.result !== undefined) {
            callback_fn(request.result);
        } else {
            console.log("No titles found");
        }
    };
}

function get_snapshots_for_app_title(app_title)
{
    return new Promise((resolve, reject) => {
      let transaction = db.transaction("snapshots"); 
      let snapshots = transaction.objectStore("snapshots");
      let titleIndex = snapshots.index("title");
      let request = titleIndex.getAll(app_title);

      request.onsuccess = function() {
          resolve(request.result);
      };
    });
}


function get_snapshot_per_id(the_id, callback_fn)
{
    let transaction = db.transaction("snapshots"); 
    let snapshots = transaction.objectStore("snapshots");
 
    let request = snapshots.get(parseInt(the_id));

    request.onsuccess = function() {
        callback_fn(request.result);
    };
}

function delete_snapshot_per_id(the_id)
{
  get_snapshot_per_id(the_id, 
  function(the_snapshot) {
    let transaction = db.transaction("snapshots", 'readwrite'); 
    let snapshots = transaction.objectStore("snapshots");
    snapshots.delete(parseInt(the_id));
    //check if this was the last snapshot of the game title 
    get_snapshots_for_app_title(0, the_snapshot.title, 
      function (ctx, app_title, snapshot_list) {
        if(snapshot_list.length == 0)
        {//when it was the last one, then also delete the app title
          let tx_apps = db.transaction("apps", 'readwrite'); 
          let apps = tx_apps.objectStore("apps");
          apps.delete(app_title);
        }
      }
    );
  });
}


//--- local storage API ---

function load_setting(name, default_value) {
    var value = localStorage.getItem(name);
    if(value === null)
    {
        return default_value;
    } 
    else
    {
        if(value=='true')
          return true;
        else if(value=='false')
          return false;
        else
          return value;
    }
}

function save_setting(name, value) {
    if (value!= null) {
      localStorage.setItem(name, value);
    } else {
      localStorage.removeItem(name);
    }
}






//-------------- custom buttons

function save_custom_buttons(the_name, the_data) {
  var app_specific_data=[];
  var global_data=[];

  for(button_def_id in the_data)
  {
    var button_def=the_data[button_def_id];
    if(button_def.transient !== undefined && button_def.transient)
    {
      //don't save transient buttons
    }
    else if(button_def.app_scope)
    {
      app_specific_data.push(button_def);
    }
    else
    {
      global_data.push(button_def); 
    }
  }
  save_custom_buttons_scope(the_name, app_specific_data);
  save_custom_buttons_scope('__global_scope__', global_data);
}



function save_custom_buttons_scope(the_name, the_data) {
  let the_custom_buttons = {
    title: the_name,
    data: the_data 
  };

  let tx_apps = db.transaction('apps', 'readwrite');
  let req_apps = tx_apps.objectStore('apps').put({title: the_name});
  req_apps.onsuccess= function(e){ 
        console.log("wrote app with id="+e.target.result)        
  };


  let tx = db.transaction('custom_buttons', 'readwrite');
  tx.oncomplete = function() {
    console.log("Transaction is complete");
  };
  tx.onabort = function() {
    console.log("Transaction is aborted");
  };
 
  try {
    let req = tx.objectStore('custom_buttons').put(the_custom_buttons);
    req.onsuccess= function(e){ 
        console.log("wrote custom_buttons with id="+e.target.result)        
    };
    req.onerror = function(e){ 
        console.error("could not write custom_buttons: ",  req.error) 
    };
  } catch(err) {
      throw err;
  }
}



var buttons_from_mixed_scopes = null;
function get_custom_buttons(the_app_title, callback_fn)
{
  get_custom_buttons_app_scope(the_app_title, 
    function(the_buttons) {
      buttons_from_mixed_scopes = the_buttons;

      //add globals
      get_custom_buttons_app_scope('__global_scope__', 
          function(the_global_buttons) {

              var last_id_in_appscope= buttons_from_mixed_scopes.data.length-1;
              for(gb_id in the_global_buttons.data)
              {
                var gb = the_global_buttons.data[gb_id];
                last_id_in_appscope++;
                gb.id=last_id_in_appscope;
                buttons_from_mixed_scopes.data.push(gb);                                
              }
              callback_fn(buttons_from_mixed_scopes.data);
          }
        );
      }
    );
}


function get_custom_buttons_app_scope(the_app_title, callback_fn)
{
  if(db === undefined)
    return;

  let transaction = db.transaction("custom_buttons"); 
  let custom_buttons = transaction.objectStore("custom_buttons");

  let request = custom_buttons.get(the_app_title);

  request.onsuccess = function() {
      if(request.result !== undefined)
      {
        for(button_id in request.result.data)
        {
          var action_button = request.result.data[button_id];
          if(action_button.app_scope === undefined)
          {
            action_button.app_scope= true;
          }
          if(action_button.lang === undefined)
          {
            //migration of js: prefix to lang property, can be removed in a later version ... 
            if(action_button.script.startsWith("js:"))
            {
              action_button.script = action_button.script.substring(3);
              action_button.lang = "javascript";
            }
            else
            {
              action_button.lang = "actionscript";
            }
          }
        }

        callback_fn(request.result);
      }
      else
      {
        let empty_custom_buttons = {
            title: the_app_title,
            data: [] 
          };

        callback_fn(empty_custom_buttons);
      }
  };
}
