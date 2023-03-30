//size of the response packet header:
let HEADER_SIZE = 4;

// Fields that compose the header that will be added to response packet
let headerVer; // header version
let messageType; // message type

module.exports = {
  data: "", // stores the binary daya of the cPTP 


  /*
  This takes three arguments, the verison, the type and the peer table
  This method will be used to initalize the cPTP header with the provided values
  */
  init: function (ver, type, pTable) {

    // This property is expected to be an array of objects that represents peers
    let numberOfPeers = pTable.table.length;

    headerVer = ver; // setting the version

    // Fill changing header fields:
    messageType = type;


    // This function is expected to convert the string into an array of bytes
    let senderNameBytes = stringToBytes(pTable.owner.peerName);

    // Build the header bitstream:
    //--------------------------
    this.data = new Buffer.alloc(HEADER_SIZE + senderNameBytes.length + numberOfPeers * 6);

    // Fill out the header array of byte with PTP header fields
    // Version
    storeBitPacket(this.data, headerVer * 1, 0, 4); // setting at specific bit positions in the data buffer

    // Message type
    storeBitPacket(this.data, messageType, 4, 8); // setting at specific bit positions in the data buffer

    // Number of peers
    storeBitPacket(this.data, numberOfPeers, 12, 8); // setting at specific bit positions in the data buffer

    // Sender name size
    storeBitPacket(this.data, senderNameBytes.length, 20, 12); // setting at specific bit positions in the data buffer
    let marker = 4;

    // for the loop below
    let j = 0;
    let i = 0;

    // This loops fills the senderNameBytes into the header buffer starting from the marker index
    for (i = marker; i < senderNameBytes.length + marker; i++) {
      this.data[i] = senderNameBytes[j++];
    }

    // If number of peers not zero
    if (numberOfPeers > 0) {
      let marker = i * 8; // Current bit position and keeps tracj of where the next segment should be stored


      // iterates through the list of peers and packs the IP addresses and ports into a bit packet
      for (var x = 0; x < numberOfPeers; x++) {

        // extracting IP address and port number of the current peer
        let IP_address = pTable.table[x].node.peerIP;
        let PORT = pTable.table[x].node.peerPort;


        // spliting the IP address into four octets and store each octet in a seperate variable
        let firstOct = IP_address.split(".")[0]; // first octet
        let secondOct = IP_address.split(".")[1]; // second octet
        let thirdOct = IP_address.split(".")[2]; // third octet
        let forthOct = IP_address.split(".")[3]; // fourth octet


        // store octet of the IP in bit packet, marker is incremented by the size of the segment 
        storeBitPacket(this.data, firstOct * 1, marker, 8);
        marker += 8;

        // store octet of the IP in bit packet, marker is incremented by the size of the segment 
        storeBitPacket(this.data, secondOct, marker, 8);
        marker += 8;

        // store octet of the IP in bit packet, marker is incremented by the size of the segment 
        storeBitPacket(this.data, thirdOct, marker, 8);
        marker += 8;

        // store octet of the IP in bit packet, marker is incremented by the size of the segment 
        storeBitPacket(this.data, forthOct, marker, 8);
        marker += 8;

        // store octet of the IP in bit packet, marker is incremented by the size of the segment 
        storeBitPacket(this.data, PORT, marker, 16);
        marker += 16;
      }
    }
  },

  //--------------------------
  // getPacket: returns the entire packet
  //--------------------------
  getPacket: function () {
    return this.message;
  },
};




// Store integer value into the packet bit stream
function storeBitPacket(packet, value, offset, length) {
  // let us get the actual byte position of the offset
  let lastBitPosition = offset + length - 1;
  let number = value.toString(2);
  let j = number.length - 1;
  for (var i = 0; i < number.length; i++) {
    let bytePosition = Math.floor(lastBitPosition / 8);
    let bitPosition = 7 - (lastBitPosition % 8);
    if (number.charAt(j--) == "0") {
      packet[bytePosition] &= ~(1 << bitPosition);
    } else {
      packet[bytePosition] |= 1 << bitPosition;
    }
    lastBitPosition--;
  }
}



function stringToBytes(str) {
  var ch,
    st,
    re = [];
  for (var i = 0; i < str.length; i++) {
    ch = str.charCodeAt(i); // get char
    st = []; // set up "stack"
    do {
      st.push(ch & 0xff); // push byte to stack
      ch = ch >>> 8; // shift value down by 1 byte
    } while (ch);
    // add stack contents to result
    // done because chars have "wrong" endianness
    re = re.concat(st.reverse());
  }
  // return an array of bytes
  return re;
}
