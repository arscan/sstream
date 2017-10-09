import express from 'express';
import fs from 'fs';

const app = express()
const openConnections = []
const data = [
  // {type: 'birth'},                                                                                                                                                        
  // {type: 'death'},
  // {type: 'condition-onset'},
  // {type: 'condition-resolved'},
  // {type: 'procedure'},
  // {type: 'encounter'}
];

let id = 0;

fs.readdir('./data', function(err, filenames) {
  if (err) {
    onError(err);
    return;
  }
  let count = 0;
  filenames.forEach(function(filename, index) {
    fs.readFile('./data/' + filename, 'utf-8', function(err, content) {
      if (err) {
        onError(err);
        return;
      }
      count++;
      console.log('Loaded ' + count + ' of ' + filenames.length);// console.log(JSON.parse(content));
      let bundle = JSON.parse(content);
      let events = [];
      let patientName = '';
      let gender = '';
      let birthDate = '';
      // console.log(bundle.entry);
      bundle.entry.forEach((obj) => {
        switch(obj.resource.resourceType){
          case 'Patient':
            patientName = obj.resource.name[0].given[0] + ' ' + obj.resource.name[0].family;
            gender = obj.resource.gender;
            events.push({type: 'birth'})
            birthDate = obj.resource.birthDate;
            break;
          case 'Condition':
            events.push({type: 'condition-onset', value: obj.resource.code.text})
            if(obj.resource.abatementDateTime){
              events.push({type: 'condition-abatement', value: obj.resource.code.text})
            }
            break;
          case 'Encounter':
            events.push({type: 'encounter', class: obj.resource.class.code, value: obj.resource.type[0].text})
            if(obj.resource.type[0].text === 'Death Certification'){
              events.push({type: 'death'});
            }
            break;
          case 'Procedure':
            events.push({type: 'procedure', code: obj.resource.code.text})
            break;
        };
      });

      let pos = randomPosition();

      if(patientName.length > 0){
        data.push.apply(data, events.map((item) => {
          item.name = patientName;
          item.gender = gender;
          item.birthDate =birthDate;
          item.lat = pos[0];
          item.lon = pos[1];
          return item;
        }));

      }
      // onFileContent(filename, content);
    });
  });
});

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.get('/events', (req, res) => {

  let eps = 10;

  if (req.query.eps){
    eps = Math.max(Math.min(req.query.eps,1000),1);
  }

  req.socket.setTimeout(Number.MAX_VALUE);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache', 'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('\n');

  openConnections.push(res);
  console.log("New Connection.  Current Connections: " + openConnections.length);

  res.clearInterval = setInterval(function(){
    if(data.length > 0){
      setTimeout(() => sendData(data[Math.floor(Math.random() * data.length)]), Math.random() * 3 * 1000/eps);
    }

  }, 1000/eps);


  req.on("close", function() {
    var toRemove;
    for (var j =0 ; j < openConnections.length ; j++) {
      if (openConnections[j] == res) {
        console.log("clearing interval");
        clearInterval(res.clearInterval);
        toRemove =j;
        break;
      }
    }
    openConnections.splice(j,1);
    sendData({
      type: "meta-disconnect",
      size: openConnections.length
    });
    console.log("Closed Connection. Current Connections: " + openConnections.length);
  });

  sendData({
    type: "meta-connect",
    size: openConnections.length
  });
});

var sendData = function(data){
  openConnections.forEach(function(resp) {
    // resp.write('id: ' + Date.now() + '\n');
    id++;
    resp.write('id: ' + id + '\n');
    resp.write('data:' + JSON.stringify(data) +   '\n\n');
  });
};

var randomPosition = function(){
  return [31 + Math.random() * 17, -70 - 50 * Math.random()]
}



setInterval(function(){
  sendData({
    type: "meta-heartbeat",
    size: openConnections.length
  });
}, 3000);


app.listen(1337, () => {
  console.log('Example app listening on port 1337!')
})
