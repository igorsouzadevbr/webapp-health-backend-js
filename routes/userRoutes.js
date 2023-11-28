module.exports = (connection, app, users, adminFunctions, alterDataWithTokens, attendantFunctions, attendantFlow, authenticateClient) => {
 app.put('/api/users/create', authenticateClient, (req, res) => {
    users.create(req, res);
  });
  
  app.post('/api/users/create/location', authenticateClient, (req, res) => {
    users.createLocation(req, res);
  });
  
  app.patch('/api/users/update/location', authenticateClient, (req, res) => {
    users.createLocation(req, res);
  });
  
  app.patch('/api/users/update', authenticateClient, (req, res) => {
    users.alterUserData(req, res);
  });
  
  app.post('/api/users/login', authenticateClient, (req, res) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    users.verifyLogin(req, res, token);
  });
  
  app.post('/api/users/update/token/password', authenticateClient, (req, res) => {
    alterDataWithTokens.getTokenToAlterUserPassword(req, res);
  });
  
  app.patch('/api/users/update/password', authenticateClient, (req, res) => {
    alterDataWithTokens.verifyTokenAndAlterUserPassword(req, res);
  });
  
  app.get('/api/users/update/token/email', authenticateClient, (req, res) => {
    alterDataWithTokens.getTokenToAlterUserEmail(req, res);
  });
  
  app.patch('/api/users/update/email', authenticateClient, (req, res) => {
    alterDataWithTokens.verifyTokenAndAlterUserEmail(req, res);
  });
  
  app.post('/api/users/info', authenticateClient, (req, res) => {
    users.getUserData(req, res);
  });
  
  app.post('/api/users/location/info', authenticateClient, (req, res) => {
    users.getUserAddressData(req, res);
  });
  
  app.patch('/api/users/update/userphoto', authenticateClient, (req, res) => {
    users.insertUserPhoto(req, res);
  });

  //SISTEMA
  app.post('/api/system/verify/email', authenticateClient, (req, res) => {
    users.verifyUserEmail(req, res);
  });
  
  app.post('/api/system/users/unban', authenticateClient, (req, res) => {
    users.unBanUser(req, res);
  });
  
  app.post('/api/system/users/unblock', authenticateClient, (req, res) => {
    users.unBlockUser(req, res);
  });

  //ADMIN & ATTENDANT
  app.put('/api/admin/users/create', authenticateClient, (req, res) => {
    adminFunctions.create(req, res);
  });
  
  app.put('/api/attendant/users/create', authenticateClient, (req, res) => {
    attendantFunctions.create(req, res);
  });

  app.post('/api/attendant/approve', authenticateClient, (req, res) => {
    attendantFunctions.approveAttendant(req, res);
  });
  
  app.patch('/api/attendant/users/update', authenticateClient, (req, res) => {
    attendantFunctions.alterAttendantData(req, res);
  });
  
  app.post('/api/chat/queue/attendant/enter', authenticateClient, (req, res) => {
    attendantFlow.turnAttendantOnline(req, res);
  });
  
  app.post('/api/chat/queue/attendant/leave', authenticateClient, (req, res) => {
    attendantFlow.turnAttendantOffline(req, res);
  });

  app.post('/api/attendant/queue/get', authenticateClient, (req, res) => {
    attendantFlow.listChatQueue(req, res);
  });
  
  app.post('/api/attendant/queue/scheduled/get', authenticateClient, (req, res) => {
    attendantFlow.listChatQueueScheduled(req, res);
  });
  
  app.post('/api/attendant/queue/accept', authenticateClient, (req, res) => {
    attendantFlow.acceptChat(req, res);
  });
  
  app.post('/api/attendant/get', authenticateClient, (req, res) => {
    attendantFlow.getAttendantData(req, res);
  });
  
  app.post('/api/patient/get', authenticateClient, (req, res) => {
    patientFlow.getPatientData(req, res);
  });

  app.post('/api/attendant/schedules/get', authenticateClient, (req, res) => {
    system.getAttendantScheduledQuantity(req, res);
  });

  app.post('/api/attendant/status', authenticateClient, (req, res) => {
    system.turnAttendantStatus(req, res);
  });
  
  app.post('/api/attendant/status/get', authenticateClient, (req, res) => {
    system.getAttendantStatus(req, res);
  });
};