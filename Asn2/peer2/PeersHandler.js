// importing modules
let net = require("net"),
  kadPTPpacket = require("./kadPTPmessage"),
  singleton = require("./Singleton");

let myReceivingPort = null;
let mySendingPort = null;

let peersList = [];

// exporting module
module.exports = {

  // This method is used for new clients
  handleClientJoining: function (sock, serverDHTtable) {
    // accept anyways in this assignment
    handleClient(sock, serverDHTtable);

  },

  // This method is used for communication
  handleCommunications: function (clientSocket, clientName, clientDHTtable) {
    communicate(clientSocket, clientName, clientDHTtable)
  }
};

// This function has two parameters, the socket and the DHT table
function handleClient(sock, serverDHTtable) {
  let kadPacket = null;

  // string representing peer's IP address and port number
  let joiningPeerAddress = sock.remoteAddress + ":" + sock.remotePort; 

  // initialize client DHT table
  let joiningPeerID = singleton.getPeerID(sock.remoteAddress, sock.remotePort)

  // new object is initalized with following properties 
  let joiningPeer = {
    peerName: "",
    peerIP: sock.remoteAddress,
    peerPort: sock.remotePort,
    peerID: joiningPeerID
  };

  // event listener triggered only when the client is sending kadPTP message
  sock.on('data', (message) => {
    kadPacket = parseMessage(message);
  });

  // event listener for when packet is done sending
  sock.on('end', () => {

    // if the client edded the connection
    if (kadPacket) {
      // The message type cannot be 1, but it can be 2 or greater
      if (kadPacket.msgType == 2) {

        // outputing hello message
        console.log("Received Hello Message from " + kadPacket.senderName);

        // checking if peerList has at least one object
        if (kadPacket.peersList.length > 0) {
          let output = "  along with DHT: ";


          // now we can assign the peer name of the senderName
          joiningPeer.peerName = kadPacket.senderName;

          // interates over all the elements in peerlist 
          for (var i = 0; i < kadPacket.peersList.length; i++) {

            // appending a string to the output
            output +=
              "[" +
              kadPacket.peersList[i].peerIP + ":" + // IP address
              kadPacket.peersList[i].peerPort + ", " + // Port 
              kadPacket.peersList[i].peerID + // ID
              "]\n                  ";
          }
          console.log(output);
        }

        // returns first element e for when peerPort = joiningPeer.peerPort
        let exist = serverDHTtable.table.find(e => e.node.peerPort == joiningPeer.peerPort);

        // if the peerPort = joiningPeer.peerPort assign
        if (exist) {
          exist.node.peerName = joiningPeer.peerName;
        } else {
          pushBucket(serverDHTtable, joiningPeer);
        }

        // Now update the DHT table
        updateDHTtable(serverDHTtable, kadPacket.peersList);
      }
    } 

    // executed if the kadPacket doesn't have a peerList
    else {
      // This was a bootstrap request
      console.log("Connected from peer " + joiningPeerAddress + "\n");
      // add the requester info into server DHT table
      pushBucket(serverDHTtable, joiningPeer);
    }
  });

  if (kadPacket == null) {
    //  bootstrap request
    // send acknowledgment to client
    kadPTPpacket.init(7, 1, serverDHTtable);
    sock.write(kadPTPpacket.getPacket());
    sock.end();
  }
}

function communicate(clientSocket, clientName, clientDHTtable) {

  // This line is used to indetify the sender of the message
  let senderPeerID = singleton.getPeerID(clientSocket.remoteAddress, clientSocket.remotePort)


  // event listener for when data is received on the socket 
  clientSocket.on('data', (message) => {

    let kadPacket = parseMessage(message); // takes raw message received and parses into a format that can be used

    let senderPeerName = kadPacket.senderName; 

    // This object represents the sender of the message and is used to track and communicate with peers
    let senderPeer = {
      peerName: senderPeerName,
      peerIP: clientSocket.remoteAddress,
      peerPort: clientSocket.remotePort,
      peerID: senderPeerID
    };

    // checking message type
    if (kadPacket.msgType == 1) {
      // This message comes from the server
      console.log(
        "Connected to " +
        senderPeerName +
        ":" +
        clientSocket.remotePort +
        " at timestamp: " +
        singleton.getTimestamp() + "\n"
      );

      // Now run as a server
      myReceivingPort = clientSocket.localPort;

      // used to identify the local peer
      let localPeerID = singleton.getPeerID(clientSocket.localAddress, myReceivingPort);
      let serverPeer = net.createServer();

      // server is listening 
      serverPeer.listen(myReceivingPort, clientSocket.localAddress);
      console.log(
        "This peer address is " +
        clientSocket.localAddress +
        ":" +
        myReceivingPort +
        " located at " +
        clientName +
        " [" + localPeerID + "]\n"
      );

      // Wait for other peers to connect
      serverPeer.on("connection", function (sock) {
        // again we will accept all connections in this assignment
        handleClient(sock, clientDHTtable);
      });

      console.log("Received Welcome message from " + senderPeerName) + "\n";

      // checking is peers are in peerList
      if (kadPacket.peersList.length > 0) {

        // string for output
        let output = "  along with DHT: ";

        // iterating over peerList
        for (var i = 0; i < kadPacket.peersList.length; i++) {

          // output with peer info
          output +=
            "[" +
            kadPacket.peersList[i].peerIP + ":" +
            kadPacket.peersList[i].peerPort + ", " +
            kadPacket.peersList[i].peerID +
            "]\n                  ";
        }
        console.log(output);
      } else {
        console.log("  along with DHT: []\n");
      }

      // add the bootstrap node into the DHT table but only if it is not exist already
      let exist = clientDHTtable.table.find(e => e.node.peerPort == clientSocket.remotePort);
      if (!exist) {
        pushBucket(clientDHTtable, senderPeer);
      } else {
        console.log(senderPeer.peerPort + " is exist already")
      }

      // updating DHT table
      updateDHTtable(clientDHTtable, kadPacket.peersList)

    } else {
      // consider different message types later
      console.log("The message type " + kadPacket.msgType + " is not supported")
    }
  });

  // event listener for end
  clientSocket.on("end", () => {
    // disconnected from server
    sendHello(clientDHTtable)
  })
}

function updateDHTtable(DHTtable, list) {


  // Refresh the local k-buckets using the transmitted list of peers. 
  refreshBucket(DHTtable, list)
  console.log("Refresh k-Bucket operation is performed.\n");

  // checking if DHTtable has any elements
  if (DHTtable.table.length > 0) {

    // output string
    let output = "My DHT: ";

    // iterating over every element in DHTtable
    for (var i = 0; i < DHTtable.table.length; i++) {

      // adding DHTtable peers info
      output +=
        "[" +
        DHTtable.table[i].node.peerIP + ":" +
        DHTtable.table[i].node.peerPort + ", " +
        DHTtable.table[i].node.peerID +
        "]\n        ";
    }
    console.log(output);
  }

}

function parseMessage(message) {

  let kadPacket = {}
  peersList = []; // holds information about peers


  let bitMarker = 0; // used to keep track of current position in message

  kadPacket.version = parseBitPacket(message, 0, 4); // first four bits are the version
  bitMarker += 4; // moving marker


  kadPacket.msgType = parseBitPacket(message, 4, 8); // next 4 bits is the message type
  bitMarker += 8; // moving marker


  let numberOfPeers = parseBitPacket(message, 12, 8); // next 8 bits is the number of peers
  bitMarker += 8; // moving marker


  let SenderNameSize = parseBitPacket(message, 20, 12); // next 12 bits is size of the name from the sender
  bitMarker += 12; // moving marker

  // converting bytes representing the name to a string
  kadPacket.senderName = bytes2string(message.slice(4, SenderNameSize + 4));
  bitMarker += SenderNameSize * 8; // updating marker

  // checking is peers exist
  if (numberOfPeers > 0) {

    // iterating over peers
    for (var i = 0; i < numberOfPeers; i++) {

      // getting first octet
      let firstOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8; // moving marker

      // getting second octet
      let secondOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8; // moving marker

      // getting third octet
      let thirdOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8; // moving marker

      // getting fourth octet
      let forthOctet = parseBitPacket(message, bitMarker, 8);
      bitMarker += 8; // moving marker

      // getting port
      let port = parseBitPacket(message, bitMarker, 16);
      bitMarker += 16; // moving marker

      // constructing IP address
      let IP = firstOctet + "." + secondOctet + "." + thirdOctet + "." + forthOctet;
      let peerID = singleton.getPeerID(IP, port);
      let aPeer = {
        peerIP: IP,
        peerPort: port,
        peerID: peerID
      };
      peersList.push(aPeer); // adding to peer list
    }
  }
  kadPacket.peersList = peersList;
  return kadPacket;
}

function refreshBucket(T, peersList) {
  peersList.forEach(P => {
    pushBucket(T, P);
  });
}

// pushBucket method stores the peer’s information 
// into the appropriate k-bucket of the DHTtable. 
function pushBucket(T, P) {

  // making sure given peer is not local peer
  if (T.owner.peerID != P.peerID) {

    // converting from hex to binary
    let localID = singleton.Hex2Bin(T.owner.peerID);
    let receiverID = singleton.Hex2Bin(P.peerID);


    // Count how many bits match starting with the left most
    // when there is a mismatch the loop breaks
    let i = 0;
    for (i = 0; i < localID.length; i++) {
      if (localID[i] != receiverID[i])
        break;
    }

    // creating an pbject for the buckets
    let k_bucket = {
      prefix: i, // this variable represents the position of the leftmost bit that is different
      node: P // P is the peer we want to add to the bucket
    };

    // search for T.table array that satisfies e.prefix == i
    let exist = T.table.find(e => e.prefix === i);


    if (exist) {
      // If the distance of k_bucket is smaller than the distance of exist, then the code below will execute
      if (singleton.XORing(localID, singleton.Hex2Bin(k_bucket.node.peerID)) <
        singleton.XORing(localID, singleton.Hex2Bin(exist.node.peerID))) {


        // iterate over table
        for (var k = 0; k < T.table.length; k++) {
          if (T.table[k].node.peerID == exist.node.peerID) {
            console.log("** The peer " + exist.node.peerID + " is removed and\n** The peer " + 
            k_bucket.node.peerID + " is added instead")

            // removes one element at index K from T.table
            T.table.splice(k, 1);
            break;
          }
        }
        // add the new one to the end of the table   
        T.table.push(k_bucket);
      }
    } 
    // add the new one to the end of the table   
    else {
      T.table.push(k_bucket);
    }
  }

}
// The method scans the k-buckets of T and send hello message packet to every peer P in T, one at a time. 
function sendHello(T) {
  let i = 0;
  // we use echoPeer method to do recursive method calls
  echoPeer(T, i);
}

// This method call itself (T.table.length) number of times,
// each time it sends hello messags to all peers in T
function echoPeer(T, i) {

  // sets timeout of 500ms before running code below
  setTimeout(() => {

    let sock = new net.Socket(); // creating new instance net.Socket

    // attempts to establish TCP connection to remote host
    sock.connect(
      {
        port: T.table[i].node.peerPort,
        host: T.table[i].node.peerIP,
        localPort: T.owner.peerPort
      },

      () => {
        // send Hello packet 
        kadPTPpacket.init(7, 2, T); // initialize packet with sepcified parameters
        sock.write(kadPTPpacket.getPacket()); // writing

        // setting timeout to 500ms before closing and destroying socket connection
        setTimeout(() => {
          sock.end();
          sock.destroy();
        }, 500)
      }
    );

    // registers a callback function that runs when the socket connection is closed
    sock.on('close', () => {
      i++;
      if (i < T.table.length) {
        echoPeer(T, i)
      }
    })

    // checks if the current i value is equal to the last index of T.table then logs message
    if (i == T.table.length - 1) {
      console.log("Hello packet has been sent.\n");
    }
  }, 500)
}

function bytes2string(array) {
  var result = "";
  for (var i = 0; i < array.length; ++i) {
    if (array[i] > 0) result += String.fromCharCode(array[i]);
  }
  return result;
}

// return integer value of a subset bits
function parseBitPacket(packet, offset, length) {
  let number = "";
  for (var i = 0; i < length; i++) {
    // let us get the actual byte position of the offset
    let bytePosition = Math.floor((offset + i) / 8);
    let bitPosition = 7 - ((offset + i) % 8);
    let bit = (packet[bytePosition] >> bitPosition) % 2;
    number = (number << 1) | bit;
  }
  return number;
}


