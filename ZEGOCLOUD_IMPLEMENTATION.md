# ZegoCloud Video Calling Implementation

## Overview
This document describes the real ZegoCloud SDK integration for video calling between mentors and students.

## Implementation Details

### Frontend (React + TypeScript)
- **Package**: `@zegocloud/zego-uikit-prebuilt` v2.17.1
- **Component**: `frontend/src/components/RealVideoCall.tsx`
- **Features**:
  - Real 1-on-1 video calling
  - Audio/video controls (mute, camera toggle)
  - Screen sharing capability
  - Real-time chat sidebar using Socket.IO
  - Professional video interface with ZegoCloud UIKit

### Backend (Node.js)
- **Service**: `backend/services/zegoService.js`
- **Route**: `/api/sessions/:sessionId/token` for token generation
- **Socket.IO**: Real-time chat synchronization

### Configuration
- **App ID**: 1580311335
- **Server Secret**: fc5348369ada20771aa582a01213161f
- **Environment Variables**:
  - Backend: `ZEGOCLOUD_APP_ID`, `ZEGOCLOUD_SERVER_SECRET`
  - Frontend: `VITE_ZEGOCLOUD_APP_ID`, `VITE_ZEGOCLOUD_SERVER_SECRET`

## Key Features

### 1. Real Video Calling
- Uses ZegoCloud UIKit v2.x for professional video interface
- Supports 1-on-1 video conferences
- Auto-layout for optimal viewing experience
- Built-in audio/video controls

### 2. Real-time Chat
- Socket.IO integration for instant messaging
- Chat messages sync across all devices
- Persistent chat history during session
- User identification with timestamps

### 3. Session Management
- Automatic session creation for confirmed bookings
- Join window: 15 minutes before to 30 minutes after scheduled time
- Attendance tracking for both participants
- Session completion with payment distribution

## Testing

### Test Session Created
- **Booking ID**: 694028d524173c5cc2f25908
- **Session ID**: 694028d524173c5cc2f2590d
- **Scheduled**: Today at 3:30 PM
- **Participants**:
  - Mahesh (Achiever): maheshsirigiri79@gmail.com
  - Giri (Aspirant): dg2962787@gmail.com

### How to Test
1. **Device 1**: Login as Mahesh (maheshsirigiri79@gmail.com)
2. **Device 2**: Login as Giri (dg2962787@gmail.com)
3. Both users navigate to their dashboard
4. Click "Join Session" when available
5. Test video calling and chat functionality

## Technical Implementation

### ZegoCloud UIKit v2.x Integration
```typescript
// Generate Kit Token
const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
  appID,
  serverSecret,
  roomId,
  userId,
  userName
);

// Create and join room
const zp = ZegoUIKitPrebuilt.create(kitToken);
zp.joinRoom({
  container: containerRef.current,
  scenario: {
    mode: ZegoUIKitPrebuilt.VideoConference,
  },
  turnOnMicrophoneWhenJoining: true,
  turnOnCameraWhenJoining: true,
  showScreenSharingButton: true,
  maxUsers: 2,
  // ... other configurations
});
```

### Socket.IO Chat Integration
```typescript
// Join session room
socket.emit('join-session', { sessionId, userType, userId });

// Send messages
socket.emit('send-message', { sessionId, message });

// Listen for messages
socket.on('new-message', (message) => {
  setChatMessages(prev => [...prev, message]);
});
```

## Deployment Notes

### Environment Setup
1. Ensure ZegoCloud credentials are properly set in environment files
2. Frontend uses Vite environment variables (VITE_*)
3. Backend uses standard environment variables

### Network Requirements
- Stable internet connection for both participants
- WebRTC support in browsers
- Firewall/NAT traversal handled by ZegoCloud

### Browser Compatibility
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers supported
- Camera/microphone permissions required

## Troubleshooting

### Common Issues
1. **"Failed to initialize video call"**: Check internet connection and ZegoCloud credentials
2. **Chat not syncing**: Verify Socket.IO connection to backend
3. **Video not showing**: Check camera permissions and browser compatibility
4. **Audio issues**: Verify microphone permissions

### Debug Information
- Check browser console for ZegoCloud logs
- Monitor Socket.IO connection status
- Use `/api/sessions/debug/:bookingId` endpoint for session info

## Security Considerations
- ZegoCloud tokens are generated server-side
- Session access is authenticated via JWT tokens
- Room IDs are unique and time-limited
- User permissions validated before joining

## Performance Optimization
- ZegoCloud handles video encoding/decoding
- Automatic quality adjustment based on network
- Efficient Socket.IO event handling
- Minimal frontend state management

## Future Enhancements
- Recording functionality
- Whiteboard integration
- File sharing during sessions
- Session analytics and metrics