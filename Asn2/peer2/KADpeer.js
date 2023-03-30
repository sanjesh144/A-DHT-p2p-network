// importing modules
let net = require("net"),
  singleton = require("./Singleton"),
  handler = require("./PeersHandler");
let os = require("os");

singleton.init(); // initializes the singleton instance


let directory = __dirname.split("\\"); // get current working directory, and then splits into an array of directory names
let myName = directory[directory.length - 1]; // getting last element, which is current folder

let ifaces = os.networkInterfaces(); // getting list of all network interfaces
let HOST = "";
let PORT = singleton.getPort(); //get random port number

// get the loaclhost ip address
// the loop iterates over each network interface object in the ifaces object
Object.keys(ifaces).forEach(function (ifname) {

  // iterates over each IP address object associated with current netwrok interface
  ifaces[ifname].forEach(function (iface) {

    // check if the current IP is IPv4
    if ("IPv4" == iface.family && iface.internal !== false) {
      HOST = iface.address; // setting HOST
    }
  });
});


// returns a unique identifier for current peer
let serverID = singleton.getPeerID(HOST, PORT);

// program is being called as a client 
if (process.argv.length > 2) {
  // call as node KADpeer [-p <serverIP>:<port>]

  // This peer runs as a client
  // this needs more work to validate the command line arguments
  let firstFlag = process.argv[2]; // should be -p, meaning it contains IP address and port
  let hostserverIPandPort = process.argv[3].split(":"); // getting IP address and port

  // storing IP address and host in seperate variables
  let knownHOST = hostserverIPandPort[0];
  let knownPORT = hostserverIPandPort[1];

  // connect to the known peer address (any peer act as a server)
  let clientSocket = new net.Socket();
  let port = singleton.getPort();
  clientSocket.connect({ port: knownPORT, host: knownHOST, localPort: port }, () => {


    // initialize client DHT table with relevant information
    let clientID = singleton.getPeerID(clientSocket.localAddress, port)
    let clientPeer = {
      peerName: myName, // client name
      peerIP: clientSocket.localAddress,
      peerPort: port,
      peerID: clientID
    };

    let clientDHTtable = {
      owner: clientPeer,
      table: []
    }

    // communicating between clent and know peer
    handler.handleCommunications(clientSocket, myName /*client name*/, clientDHTtable);
  });

} 

else {
  // call as node peer (no arguments)
  // run as a server
  // net.Server objeect listens for incoming connections
  let serverSocket = net.createServer();
  serverSocket.listen(PORT, HOST);
  console.log(
    "This peer address is " + HOST + ":" + PORT + " located at " + myName /*server name*/ + " [" + serverID + "]"
  );

  // initialize server DHT table
  let serverPeer = {
    peerName: myName,
    peerIP: HOST,
    peerPort: PORT,
    peerID: serverID
  };

  let serverDHTtable = {
    owner: serverPeer,
    table: []
  }

  // event listener, when event occurs call handleClientJoining
  serverSocket.on("connection", function (sock) {
    // received connection request
    handler.handleClientJoining(sock, serverDHTtable);
  });

}
