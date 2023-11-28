module.exports = (connection, app, system, authenticateClient) => {

   app.get('/api/system/usertypes', authenticateClient, (req, res) => {
      system.getUserTypes(req, res);
    });
    
    app.get('/api/system/city/id/:cityid', authenticateClient, (req, res) => {
      system.getCityByID(req, res);
    });
    
    app.get('/api/system/city/name/:cityname', authenticateClient, (req, res) => {
      system.getCityByName(req, res);
    });
    
    app.get('/api/system/state/id/:stateid', authenticateClient, (req, res) => {
      system.getStateByID(req, res);
    });
    
    app.get('/api/system/state/name/:statename', authenticateClient, (req, res) => {
      system.getStateByName(req, res);
    });
    
    app.get('/api/system/state/abbreviation/:stateab', authenticateClient, (req, res) => {
      system.getStateByAb(req, res);
    });
    
    app.get('/api/system/gender/id/:genderid', authenticateClient, (req, res) => {
      system.getGenderByID(req, res);
    });
    
    app.get('/api/system/gender/name/:gendername', authenticateClient, (req, res) => {
      system.getGenderByName(req, res);
    });
    
    app.get('/api/system/cep/:postalcode', authenticateClient, (req, res) => {
      system.getPostalCode(req, res);
    });
    
    app.post('/api/system/verify/attendant', authenticateClient, (req, res) => {
      system.verifyIfAttendantIsAvailable(req, res);
    });
};