module.exports = (connection, app, system, scheduleLocationFunctions, scheduleFunctions, authenticateClient) => {

  app.post('/api/schedules/location/create', authenticateClient, (req, res) => {
    scheduleLocationFunctions.createLocation(req, res);
  });
  
  app.post('/api/schedules/location/get', authenticateClient, (req, res) => {
    scheduleLocationFunctions.getLocation(req, res);
  });
  
  app.post('/api/schedules/location/name/get', authenticateClient, (req, res) => {
    scheduleLocationFunctions.getLocationByName(req, res);
  });

  app.post('/api/schedules/professional/get', authenticateClient, (req, res) => {
    scheduleFunctions.getHoursByAttendants(req, res);
  });
  
  app.post('/api/patient/schedules/cancel', authenticateClient, (req, res) => {
    scheduleLocationFunctions.cancelSchedule(req, res);
  });
  
  app.post('/api/attendant/schedules/accept', authenticateClient, (req, res) => {
    scheduleFunctions.acceptPendingSchedule(req, res);
  });
  
  app.post('/api/schedules/create', authenticateClient, (req, res) => {
    scheduleFunctions.createSchedule(req, res);
  });
  
  app.post('/api/schedules/date/get', authenticateClient, (req, res) => {
    scheduleFunctions.listUnavailableHours(req, res);
  });

  app.post('/api/schedules/date/location/get', authenticateClient, (req, res) => {
    scheduleFunctions.listUnavailableHoursByLocation(req, res);
  });

  
  app.post('/api/schedules/patient/verify', authenticateClient, (req, res) => {
    scheduleFunctions.verifySchedule(req, res);
  });

  app.post('/api/schedules/patient/get', authenticateClient, (req, res) => {
    scheduleFunctions.listSchedules(req, res);
  });

  app.post('/api/attendant/schedules/pending/get', authenticateClient, (req, res) => {
    scheduleFunctions.listSchedulesPending(req, res);
  });
  
  app.post('/api/attendant/schedules/confirmed/get', authenticateClient, (req, res) => {
    scheduleFunctions.listSchedulesConfirmed(req, res);
  });

  app.post('/api/attendant/schedules/get', authenticateClient, (req, res) => {
    system.getAttendantScheduledQuantity(req, res);
  });

  app.patch('/api/attendant/schedules/meet/update', authenticateClient, (req, res) => {
    scheduleFunctions.syncLinkToSchedule(req, res);
  });

};