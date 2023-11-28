
module.exports = (connection, app, system, attendantFlow, patientFlow, authenticateClient) => {
 app.get('/api/chat/categories/get', authenticateClient, (req, res) => {
    system.getAllCategoriesWithAttendantsAvailable(req, res);
  });
  
  app.post('/api/chat/attendant/random', authenticateClient, (req, res) => {
    system.getAvailableChatAttendant(req, res);
  });
  
  app.get('/api/chat/attendant/get', authenticateClient, (req, res) => {
    attendantFlow.getAllAttendantsFromDB(req, res);
  });
  app.get('/api/chat/attendant/get/pagination', authenticateClient, (req, res) => {
    attendantFlow.getAllAttendantsFromDBWithPagination(req, res);
  });
  
  app.post('/api/chat/attendant/get/category', authenticateClient, (req, res) => {
    attendantFlow.getAttendantsByCategoryFromDB(req, res);
  });
  
  app.post('/api/chat/quiz/get', authenticateClient, (req, res) => {
    system.getQuizFromConversation(req, res);
  });
  
  app.post('/api/chat/get', authenticateClient, (req, res) => {
    system.getAllMessagesFromConversation(req, res);
  });
  
  app.post('/api/chat/queue/enter', authenticateClient, (req, res) => {
    patientFlow.callAttendant(req, res);
  });

};