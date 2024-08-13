import React, { useEffect, useRef, useState } from "react";
import Button from "@material-ui/core/Button";
import { drawConnectors, drawLandmarks } from "@mediapipe/drawing_utils";
import TextField from "@material-ui/core/TextField";
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import JoinIcon from "@material-ui/icons/Group";
import Peer from "simple-peer";
import io from "socket.io-client";
import Confetti from "react-confetti"
import { createMuiTheme, ThemeProvider } from "@material-ui/core/styles";
import "./App.css";
import loadingGif from './loading.gif'; 
import confettiGif from './confetti.gif';
const socket = io.connect("https://squat-showdown.onrender.com");

const theme = createMuiTheme({
  palette: {
    primary: {
      main: '#0047d4', 
    },
    secondary: {
      main: '#00b300', 
    },
    third: {
      main: '00941b',
    }
  },
  typography: {
    fontFamily: 'Arial, sans-serif', 
  },
});

function App() {
  const [me, setMe] = useState(null); 
  const [stream, setStream] = useState();
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [opponentReady, setOpponentReady] = useState(false);
  const [mySquatCount, setMySquatCount] = useState(0); 
  const [userSquatCount, setUserSquatCount] = useState(0); 
  const [callerSignal, setCallerSignal] = useState();
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState(""); 
  const [callEnded, setCallEnded] = useState(false);
  const [winner, setWinner] = useState(null);
  const [isHost, setIsHost] = useState(true); 
  const [showRoomCode, setShowRoomCode] = useState(false); 
  const [showButtons, setShowButtons] = useState(true); 
  const [loading, setLoading] = useState(false); 
  const [callerName, setCallerName] = useState(""); 
  const [name, setName] = useState("");
  const [displayRoomCode, setDisplayRoomCode] = useState('');
  const displayRoomCodeRef = useRef(displayRoomCode); 
  const [ready, setReady] = useState(false);
  const [bothReady, setBothReady] = useState(false); 
  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();
  const [countdown, setCountdown] = useState(10);
  const [squatTimer, setSquatTimer] = useState(30);
  const [showCountdown, setShowCountdown] = useState(false);
  const [showSquatTimer, setShowSquatTimer] = useState(false);
  const squatTimerRunning = useRef(false); 
  const [showConfetti, setShowConfetti] = useState(false);
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });
  // For squat detection
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const squatCounterRef = useRef(0); 
  const stageRef = useRef("UP"); 
  
  function handleWindowSize() {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  useEffect(() => {
    window.onresize=() => handleWindowSize();
    if (bothReady) {
      setShowCountdown(true);
      setCountdown(10);
      setSquatTimer(30);
      squatCounterRef.current = 0;
      handleWindowSize();
      setMySquatCount(0);
      setUserSquatCount(0);
    }
  }, [bothReady]);
  useEffect(() => {
    let countdownInterval;
    let squatTimerInterval;
    
    if (bothReady && !showCountdown && !showSquatTimer) {
      setShowCountdown(true);
      countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === 1) {
            clearInterval(countdownInterval);
            setShowCountdown(false);
            setShowSquatTimer(true);
            return 0; 
          }

          return prev - 1;
        });
      }, 1000);
    }
  
    return () => {
      clearInterval(countdownInterval);
      clearInterval(squatTimerInterval);
    };
  }, [bothReady]);
  
  useEffect(() => {
    let squatTimerInterval;
    console.log(squatTimer);
    if (countdown == 0) {
      squatTimerRunning.current = true;
    }
    if (squatTimer == 0) {
      handleWindowSize();
      squatTimerRunning.current = false;
      if (mySquatCount > userSquatCount) {
        if (isHost) {
          setWinner('me');
        }
        else {
          setWinner('opponent');
        }
      } else if (userSquatCount > mySquatCount) {
          if (isHost) {
            setWinner('opponent');
          }
          else {
            setWinner('me');
          }
      } else {
        setWinner('draw'); 
      }
    }
     // Timer is running
    if (showSquatTimer) {
      squatTimerInterval = setInterval(() => {
        setSquatTimer((prev) => {
          if (prev === 1) {
            clearInterval(squatTimerInterval);
            setShowSquatTimer(false);
            squatTimerRunning.current = false; 
            return 0; 
          }
          setShowSquatTimer(true);
          return prev - 1;
        });
      }, 1000);
    }
  
    return () => {
      clearInterval(squatTimerInterval);
    };
  }, [showSquatTimer]);
  useEffect(() => {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
      setStream(stream);
      if (myVideo.current) {
        myVideo.current.srcObject = stream;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    });
    socket.on("me", (roomCode) => {
      console.log("Received room code:", roomCode, "Current me:", me);
      if (!me) {
        setMe(roomCode); 
        setDisplayRoomCode(roomCode); 
      }
    });
    socket.on("readyStateChanged", ({ allReady, mySquatCount, userSquatCount, playersReady }) => {
      setBothReady(allReady);
      setMySquatCount(mySquatCount);
      setUserSquatCount(userSquatCount);
      const opponentId = Object.keys(playersReady).find(id => id !== socket.id);
      const isOpponentReady = opponentId ? playersReady[opponentId] : false;
      setOpponentReady(isOpponentReady);
    });
    socket.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setName(data.name);
      setCallerSignal(data.signal);
    });
    socket.on("playerReady", (player) => {
      if (player !== player) {
          setOpponentReady(true);
      }
  });
    socket.on("userJoined", () => {
      setLoading(false);
    });
    
    const pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.2/${file}`,
    });
    
    const canvas = canvasRef.current;
    const canvasCtx = canvas.getContext('2d');

    pose.onResults((results) => {
      canvasCtx.save();
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      // Comment out or remove the following line if you don't want to draw the video frame
      // canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
      
      // Remove or comment out the drawing of pose connections and landmarks
      // drawConnectors(canvasCtx, results.poseLandmarks, window.POSE_CONNECTIONS, {
      //   color: (data) => {
      //     const x0 = canvas.width * data.from.x;
      //     const y0 = canvas.height * data.from.y;
      //     const x1 = canvas.width * data.to.x;
      //     const y1 = canvas.height * data.to.y;
      //     const z0 = clamp(data.from.z + 0.5, 0, 1);
      //     const z1 = clamp(data.to.z + 0.5, 0, 1);
      //     const gradient = canvasCtx.createLinearGradient(x0, y0, x1, y1);
      //     gradient.addColorStop(0, `rgba(0, ${255 * z0}, ${255 * (1 - z0)}, 1)`);
      //     gradient.addColorStop(1.0, `rgba(0, ${255 * z1}, ${255 * (1 - z1)}, 1)`);
      //     return gradient;
      //   }
      // });
      
      // drawLandmarks(canvasCtx, Object.values(window.POSE_LANDMARKS_LEFT || {}).map(index => results.poseLandmarks[index]), { color: zColor, fillColor: '#FF0000' });
      // drawLandmarks(canvasCtx, Object.values(window.POSE_LANDMARKS_RIGHT || {}).map(index => results.poseLandmarks[index]), { color: zColor, fillColor: '#00FF00' });
      // drawLandmarks(canvasCtx, Object.values(window.POSE_LANDMARKS_NEUTRAL || {}).map(index => results.poseLandmarks[index]), { color: zColor, fillColor: '#AAAAAA' });
      
      canvasCtx.restore();
    
      squatDetection(results);
    });
    
    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        await pose.send({ image: videoRef.current });
      },
      width: 480,
      height: 480,
    });
    camera.start();

    function clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    function zColor(data) {
      const z = clamp(data.from.z + 0.5, 0, 1);
      return `rgba(0, ${255 * z}, ${255 * (1 - z)}, 1)`;
    }
    
    function calculateAngle(point1, point2, point3) {
      const angleRadians = Math.atan2(point3.y - point2.y, point3.x - point2.x) - Math.atan2(point1.y - point2.y, point1.x - point2.x);
      let angleDegrees = (angleRadians * 180.0) / Math.PI;
      if (angleDegrees > 180.0) {
        angleDegrees = 360 - angleDegrees;
      }
      return angleDegrees;
    }
    
    function squatDetection(results) {
      const landmarks = results.poseLandmarks;
      if (squatTimer === 0) {
        if (mySquatCount > userSquatCount) {
          if (isHost) {
            setWinner('me');
          }
          else {
            setWinner('opponent');
          }
        } else if (userSquatCount > mySquatCount) {
            if (isHost) {
              setWinner('opponent');
            }
            else {
              setWinner('me');
            }
        } else {
          setWinner('draw'); // Optional: Handle draw case
        }
        squatTimerRunning.current = false;
        setShowSquatTimer(false);
      }
      if (!landmarks) {
        console.error('Pose landmarks not found');
        return;
      }
      if (!squatTimerRunning.current) {
        return;
      }
      
      const leftHip = landmarks[23] || null;
      const leftKnee = landmarks[25] || null;
      const leftAnkle = landmarks[27] || null;
      const rightHip = landmarks[24] || null;
      const rightKnee = landmarks[26] || null;
      const rightAnkle = landmarks[28] || null;
      const leftShoulder = landmarks[11] || null;
      const rightShoulder = landmarks[12] || null;
    
      if (
        leftHip &&
        leftKnee &&
        leftAnkle &&
        rightHip &&
        rightKnee &&
        rightAnkle &&
        leftShoulder &&
        rightShoulder
      ) {
        const visibilityThreshold = 0.5; 

        const landmarksAreVisible = [
          landmarks[23].visibility,
          landmarks[24].visibility,
          landmarks[25].visibility,
          landmarks[26].visibility,
          landmarks[27].visibility,
          landmarks[28].visibility,
          landmarks[11].visibility,
          landmarks[12].visibility,
        ].every((visibility) => visibility > visibilityThreshold);

        if (!landmarksAreVisible) {
          return;
        }
        let leftKneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);
        let rightKneeAngle = calculateAngle(rightHip, rightKnee, rightAnkle);
    
        let lefthipAngle = calculateAngle(leftShoulder, leftHip, leftKnee);
        let righthipAngle = calculateAngle(rightShoulder, rightHip, rightKnee);
    
        const isSquatUp = leftKneeAngle > 169 && rightKneeAngle > 169 && lefthipAngle > 100 && righthipAngle > 100;
        const isSquatDown = leftKneeAngle <= 90 && rightKneeAngle <= 90 && lefthipAngle <= 100 && righthipAngle <= 100;
    
        if (isSquatDown && stageRef.current === "UP") {
          stageRef.current = "DOWN";
        } else if (isSquatUp && stageRef.current === "DOWN") {
          stageRef.current = "UP";
          squatCounterRef.current += 1;
          if (isHost && displayRoomCodeRef.current == me) {
            console.log(displayRoomCodeRef.current, me, true);
            socket.emit('updateMySquatCount', { count: squatCounterRef.current, roomCode: me, isHost: true});
          } else {
            console.log(displayRoomCodeRef.current, me, false);
            socket.emit('updateUserSquatCount', { count: squatCounterRef.current, roomCode: displayRoomCodeRef.current, isHost: false});
          }
          

        }
      } else {
        console.error('Some landmarks are undefined');
      }
    }
    socket.on("mysquatCountUpdated", ({mySquatCount, roomCode}) => {
      if (roomCode === me) { 
        setMySquatCount(mySquatCount);
      }

  });
    socket.on("usersquatCountUpdated", ({userSquatCount, roomCode}) => {
      if (roomCode === me) { 
        setUserSquatCount(userSquatCount);
      }
  });
    
    
    return () => {
      socket.off("me");
    };
  }, [me]);
  const handleReady = () => {
    setReady(true);
    socket.emit("playerReady", me);
  };
  const callUser = (roomCode) => {
    setIsHost(false);
    setLoading(true); 
    setShowButtons(false);
    setDisplayRoomCode(""); 
    setShowRoomCode(true);
    setIsHost(false);
    setMe(roomCode);
    localStorage.setItem("roomCode", roomCode);
    socket.emit("joinRoom", roomCode);
    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream
    });
    peer.on("signal", (data) => {
      socket.emit("callUser", {
        userToCall: roomCode,
        signalData: data,
        from: me,
        name: name
      });
    });
    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
      setLoading(false); 
    });
    socket.on("callAccepted", (signal) => {
      setCallAccepted(true);
      setDisplayRoomCode(roomCode); 
      localStorage.setItem('roomCode', roomCode);
      displayRoomCodeRef.current = localStorage.getItem('roomCode')
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setDisplayRoomCode(me); 
    localStorage.setItem('roomCode', me);
    displayRoomCodeRef.current = localStorage.getItem('roomCode')
    setIsHost(true);
    setCallAccepted(true);
    setLoading(true); 
    setShowRoomCode(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream
    });
    peer.on("signal", (data) => {
      socket.emit("answerCall", { signal: data, to: caller });
    });
    peer.on("stream", (stream) => {
      userVideo.current.srcObject = stream;
      setLoading(false); 
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  const leaveCall = () => {
    setCallEnded(true);
    connectionRef.current.destroy();
  };

  const createRoom = () => {
    socket.emit("createRoom"); 
    setIsHost(true);
  
    setTimeout(() => {
      setShowRoomCode(true); 
      setShowButtons(false); 
  
      // Join the room after creation
      socket.emit("joinRoom", me);
    }, 500); 
  };

  return (
    <ThemeProvider theme={theme}>
      <div>
      {winner === "draw" && <Confetti width ={windowSize.width} height={windowSize.height} numberOfPieces={300} />}
        {winner === "me" && <Confetti width ={windowSize.width/2} height={windowSize.height} numberOfPieces={300} />}
        {winner === "opponent" && <Confetti width ={windowSize.width/2} height={windowSize.height} style={{ position: 'absolute', left: windowSize.width/2 }} numberOfPieces={300}/>}
        <div className={`centered-container ${showRoomCode || loading ? 'hidden' : 'visible'}`}>
          <h1 className="header-icon">🏋️‍♂️</h1>
          <h2 className="header-title">Squat Showdown</h2>
          <h3 className="header-subtitle">Challenge your friends to a squat showdown</h3>
        </div>

        {(showRoomCode || loading) && me && (
          <div className="room-container">
            <h1 className="room-icon">🏋️‍♂️</h1>
            <h2 className="room-title">Squat Showdown</h2>
            <h3 className="room-code">Room Code: {displayRoomCode}</h3>
          </div>
        )}

        <div className="container" style={{ marginTop: '100px' }}>
          <div className="video-container">
            <div className="video">
              <video
                playsInline
                muted
                ref={myVideo}
                autoPlay
                className={showRoomCode || loading ? 'video-visible' : 'video-hidden'}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
            <div className="video">
              {(showRoomCode || loading) && !callAccepted ? (
                <img src={loadingGif} alt="Loading..." style={{ width: '100%', height: '100%' }} />
              ) : (
                callAccepted && !callEnded && (
                  <video
                    playsInline
                    ref={userVideo}
                    autoPlay
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} 
                  />
                )
              )}
            </div>
          </div>

          {showRoomCode && bothReady && (
            <div className="timer-container">
              {showCountdown && (
                <h2>Starting in: {countdown}s</h2>
              )}
              {showSquatTimer && (
                <h2>Time left: {squatTimer}s</h2>
              )}
              <div className="squat-counter-container">
                {isHost ? (
                  <>
                    <span className="my-squat-counter squat-counter" style={isMobile ? { } : { marginRight: '50%' }}>{mySquatCount}</span>
                    <span className="user-squat-counter squat-counter">{userSquatCount}</span>
                  </>
                ) : (
                  <>
                    <span className="user-squat-counter squat-counter" style={isMobile ? { marginBottom: '10rem' } : { marginRight: '50%' }}>{userSquatCount}</span>
                    <span className="my-squat-counter squat-counter">{mySquatCount}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {showRoomCode && !bothReady && (
            <div className="ready-button-container">
              <Button
                variant="contained"
                color="secondary"
                onClick={handleReady}
                disabled={ready}
                style={{ backgroundColor: ready ? 'green' : 'red', color: 'white' }}
              >
                {ready ? 'Ready' : 'Not Ready'}
              </Button>
            </div>
          )}

          {showRoomCode && !bothReady && (
            <div className="opponent-ready-button">
              <Button
                variant="contained"
                color="secondary"
                disabled
                style={{ backgroundColor: opponentReady ? 'green' : 'red', color: 'white' }}
              >
                {opponentReady ? 'Ready' : 'Not Ready'}
              </Button>
            </div>
          )}

          <div className={`myId ${showButtons ? 'visible' : 'hidden'}`}>
            <Button
              variant="contained"
              color="primary"
              onClick={createRoom}
              startIcon={<NoteAddIcon fontSize="large" />}
              style={{ marginBottom: '30px' }}
            >
              Create Room
            </Button>

            <TextField
              id="caller-name"
              label="Enter Caller Name"
              variant="filled"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ marginBottom: '20px' }}
            />

            <TextField
              id="filled-basic"
              label="Room Code to join"
              variant="filled"
              value={idToCall}
              onChange={(e) => setIdToCall(e.target.value)}
            />

            <div className="call-button">
              {callAccepted && !callEnded ? (
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={leaveCall}
                >
                  End Call
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => callUser(idToCall)}
                  startIcon={<JoinIcon fontSize="large" />}
                >
                  Join Room
                </Button>
              )}
            </div>
          </div>

          <div>
            {receivingCall && !callAccepted ? (
              <div className="caller">
                <h1 style={{ color: '#000', fontSize: isMobile ? '1.5rem' : '2.5rem', 
            marginTop: isMobile ? '60px' : '120px'}}>
                  {name} challenges you to a squat showdown!
                </h1>
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={answerCall}
                  style={{ backgroundColor: 'secondary', color: '#ffffff' }}
                >
                  Answer
                </Button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="squat-detection-container" style={{ display: 'none' }}>
          <div className="panel is-info">
            <p className="panel-heading">Webcam</p>
            <div className="panel-block">
              <video ref={videoRef} className="input_video5" autoPlay muted></video>
            </div>
          </div>
          <div className="panel is-info">
            <p className="panel-heading">Squat Showdown</p>
            <div className="panel-block">
              <canvas ref={canvasRef} className="output5" width="480px" height="480px"></canvas>
            </div>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

export default App;
