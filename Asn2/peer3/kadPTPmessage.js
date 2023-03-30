//size of the response packet header:
let HEADER_SIZE = 4;

//Fields that compose the header
let version, messageType;

module.exports = {
  message: "", //Bitstream of the cPTP header

  init: function (ver, msgType, peerTable) {
    //fill out the default header fields:   
    let noOfPeers = peerTable.table.length,
      version = ver;

    //fill changing header fields:
    messageType = msgType;

    let senderName = stringToBytes(peerTable.owner.peerName);

    //build the header bistream:
    //--------------------------
    this.message = new Buffer.alloc(HEADER_SIZE + senderName.length + noOfPeers * 6);

    //fill out the header array of byte with PTP header fields
    // V
    storeBitPacket(this.message, version * 1, 0, 4);

    // Message type
    storeBitPacket(this.message, messageType, 4, 8);

    // Number of peers
    storeBitPacket(this.message, noOfPeers, 12, 8);

    // Sender name size
    storeBitPacket(this.message, senderName.length, 20, 12);
    let byteMarker = 4;

    // Sender name
    let j = 0;
    let i = 0;
    for (i = byteMarker; i < senderName.length + byteMarker; i++) {
      this.message[i] = senderName[j++];
    }

    // if number of peer not zero
    if (noOfPeers > 0) {
      let bitMarker = i * 8; // current bit position

      for (var k = 0; k < noOfPeers; k++) {
        let IP = peerTable.table[k].node.peerIP;
        let port = peerTable.table[k].node.peerPort;
        let firstOctet = IP.split(".")[0];
        let secondOctet = IP.split(".")[1];
        let thirdOctet = IP.split(".")[2];
        let forthOctet = IP.split(".")[3];

        storeBitPacket(this.message, firstOctet * 1, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, secondOctet, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, thirdOctet, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, forthOctet, bitMarker, 8);
        bitMarker += 8;
        storeBitPacket(this.message, port, bitMarker, 16);
        bitMarker += 16;
      }
    }
  },

  //--------------------------
  //getpacket: returns the entire packet
  //--------------------------
  getPacket: function () {
    return this.message;
  },
};

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
