(function() {

  class RTCPeerToPeer {

    constructor() {

      this.socket = io();

      this.settings = {
        serverEvents: {
          videoOffer: 'video-offer',
          message: 'message',
          videoAnswer: 'video-answer',
          newIceCandidate: 'new-ice-candidate',
          hangUp: 'hang-up'
        },
        mediaConf: {
          audio: true,
          video: {
            width: 1280,
            height: 720
          }
        }
      };

      this.callButton = document.querySelector('button#callButton');
      this.hangupButton = document.querySelector('button#hangupButton');
      this.localVideo = document.querySelector('video#localVideo');
      this.remoteVideo = document.querySelector('video#remoteVideo');

      this.RTCPeerConnection = window.RTCPeerConnection
        || window.mozRTCPeerConnection
        || window.webkitRTCPeerConnection;

      this.addListeners();

      navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

      this.peerConnection = null;
    }

    addListeners() {
      const serverEvents = this.settings.serverEvents;

      this.callButton.onclick = this.callTo.bind(this);
      this.hangupButton.onclick = this.hangUp.bind(this);

      this.socket.on(serverEvents.message, message => {
        const name = this.getCurrentUser();

        switch (message.type) {
          case serverEvents.videoOffer:
            //check if message was sent not to yourself
            if (message.target === name) {
              this.answerOnCall(message);
            }
            break;
          case serverEvents.videoAnswer:
            //check if message was sent not to yourself
            if (message.target === name) {
              this.peerConnection.setRemoteDescription(new RTCSessionDescription(message.sdp));
            }
            break;
          case serverEvents.newIceCandidate:
            //check if message was sent not to yourself
            if (message.target === name) {
              this.handleNewICECandidateMsg(message);
            }
            break;
          case serverEvents.hangUp:
            //check if message was sent not to yourself
            this.closeCall();
            break;
        }
      });
    }

    addConnectionListeners(peerConnection) {
      peerConnection.onicecandidate = this.onIceCandidate.bind(this);
      peerConnection.ontrack = this.onAddStream.bind(this);
      peerConnection.onremovestream = this.onRemoveStream.bind(this);
      peerConnection.iceconnectionstatechange = this.iceConnectionStateChange.bind(this);
      peerConnection.onsignalingstatechange = this.onSignalingStateChange.bind(this);
    }

    onIceCandidate(event) {
      if (event.candidate) {
        this.socket.emit(this.settings.serverEvents.message, {
          type: this.settings.serverEvents.newIceCandidate,
          target: this.getTargetUser(),
          candidate: event.candidate
        });
      }
    }

    handleNewICECandidateMsg(data) {
      var candidate = new RTCIceCandidate(data.candidate);

      this.peerConnection.addIceCandidate(candidate)
        .catch();
    }

    onAddStream(event) {
      this.remoteVideo.srcObject = event.streams[0];
    }

    onRemoveStream() {
      this.closeCall();
    }

    iceConnectionStateChange() {
      switch(this.peerConnection.iceConnectionState) {
        case 'closed':
        case 'failed':
        case 'disconnected':
          this.closeCall();
          break;
      }
    }

    onSignalingStateChange() {
      switch(this.peerConnection.signalingState) {
        case 'closed':
          this.closeCall();
          break;
      }
    }

    closeCall() {
      if (this.peerConnection) {
        this.peerConnection.ontrack = null;
        this.peerConnection.onremovestream = null;
        this.peerConnection.onnicecandidate = null;
        this.peerConnection.oniceconnectionstatechange = null;
        this.peerConnection.onsignalingstatechange = null;

        if (this.remoteVideo.srcObject) {
          this.remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        if (this.localVideo.srcObject) {
          this.localVideo.srcObject.getTracks().forEach(track => track.stop());
        }

        this.remoteVideo.src = null;
        this.localVideo.src = null;

        this.peerConnection.close();
        this.peerConnection = null;
      }

    }

    createConnection() {
      this.peerConnection = new this.RTCPeerConnection(null);

      this.addConnectionListeners(this.peerConnection);
    }

    showLocalVideo(stream) {
      this.localVideo.src = window.URL.createObjectURL(stream);
      this.peerConnection.addStream(stream);
    }

    callTo() {

      this.createConnection();

      navigator.getUserMedia(this.settings.mediaConf, stream => {
        this.showLocalVideo(stream);
      });

      this.peerConnection.createOffer({
        mandatory: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true
        }
      }).then(offer => {
        return this.peerConnection.setLocalDescription(offer);
      })
      .then(() => {
        this.socket.emit(this.settings.serverEvents.message, {
          type: this.settings.serverEvents.videoOffer,
          name: this.getCurrentUser(),
          target: this.getTargetUser(),
          sdp: this.peerConnection.localDescription
        });
      })
      .catch();
    }

    answerOnCall(data) {

      this.createConnection();

      this.showModalForAnswer(data.name).then(() => {

        const sessionDesc = new RTCSessionDescription(data.sdp);

        this.peerConnection.setRemoteDescription(sessionDesc).then(() => {
          return navigator.mediaDevices.getUserMedia(this.settings.mediaConf);
        })
        .then(stream => {
          this.showLocalVideo(stream);
        })
        .then(() => {
          return this.peerConnection.createAnswer()
        })
        .then(offer => {
          return this.peerConnection.setLocalDescription(offer);
        })
        .then(() => {
          return this.socket.emit(this.settings.serverEvents.message, {
            type: this.settings.serverEvents.videoAnswer,
            name: this.getCurrentUser(),
            target: data.name,
            sdp: this.peerConnection.localDescription
          });
        });
      }).catch(() => {
        this.hangUp();
      });
    }

    showModalForAnswer(callerName) {
      return new Promise((resolve, reject) => {
        if (window.confirm(`User ${callerName} is calling. Do you wanna answer?`)) {
          resolve();
        } else {
          reject();
        }
      });
    }

    getCurrentUser() {
      return document.querySelector('#user').value;
    }

    getTargetUser() {
      return document.querySelector('#target').value;
    }

    hangUp() {
      this.closeCall();

      this.socket.emit(this.settings.serverEvents.message, {
        type: this.settings.serverEvents.hangUp
      });
    }
  }

  (new RTCPeerToPeer());

})();


