const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');
const moment = require('moment-timezone');

class ScheduleFunctions {
    constructor(connection) {
        this.connection = connection;
    }

    async createSchedule(req, res) {
      const databaseFramework = new dbUtils(this.connection);
      const { patientId, professionalId, startTime, isOnline, date, locationId } = req.body;
    
      const dateParts = date.split("/");
      const year = parseInt(dateParts[2], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[0], 10);
    
      const currentDate = new Date();
      const hours = currentDate.getHours();
      const minutes = currentDate.getMinutes();
    
      const convertedDate = new Date(year, month, day, hours, minutes);
    
      try {
    
        const verifyProfessionalAppointments = await databaseFramework.select("appointments", "*", "professional_id = ? and date = ? and isConfirmed = 1 and isFinished = 0", [professionalId, convertedDate]);
        if (verifyProfessionalAppointments.length === 1) {
          return res.status(409).send({ message: 'Este profissional já possui um agendamento para esta data e horário. Escolha outra.' });
        }

        //validações de agenda
        if (isOnline === 1) {
          const checkAvailability = await databaseFramework.select("attendant_schedule_availability", "*", "attendant_id = ? AND date = ? AND time = ? AND isInPerson = 0", [professionalId, convertedDate, startTime]);
          if (checkAvailability.length === 0) {
            return res.status(409).send({ message: 'Este profissional não está disponível para atendimento online nesta data e horário.' });
          }

        }
        if (isOnline === 0) {
          const checkAvailability = await databaseFramework.select("attendant_schedule_availability", "*", "attendant_id = ? AND date = ? AND time = ? AND isInPerson = 1 AND schedule_location_id = ?", [professionalId, convertedDate, startTime, locationId]);
          if (checkAvailability.length === 0) {
            return res.status(409).send({ message: 'Este profissional não está disponível para atendimento presencial nesta data e horário.' });
          }
        }

        let createSchedule;
        if (isOnline === 1) {
          createSchedule = await databaseFramework.insert("appointments", { patient_id: patientId, professional_id: professionalId, date: convertedDate, start_time: startTime, isConfirmed: 0 });
        } else {
          createSchedule = await databaseFramework.insert("appointments", { patient_id: patientId, professional_id: professionalId, date: convertedDate, start_time: startTime, isConfirmed: 0 });
        }
    
        if (isOnline === 1) {
          await databaseFramework.insert("users_appointments", { patient_id: patientId, isOnline: 1, isInPerson: 0, isConfirmed: 0, isRefused: 0, schedule_id: createSchedule });
          return res.status(200).send({ message: 'Agendamento realizado com sucesso.' });
        } else {
          await databaseFramework.insert("users_appointments", { patient_id: patientId, isOnline: 0, isInPerson: 1, isConfirmed: 0, isRefused: 0, schedule_id: createSchedule, location_id: locationId });
          return res.status(200).send({ message: 'Agendamento realizado com sucesso.' });
        }
    
      } catch (error) {
        console.error('Erro ao realizar criação de agendamento.', error);
        return res.status(500).send({ message: 'Erro ao realizar criação de agendamento. Método: createSchedule' });
      }
    }

    async listSchedules(req, res) {
      const databaseFramework = new dbUtils(this.connection);
      const { patientId } = req.body;
      moment.tz.setDefault('America/Sao_Paulo');
      const currentDate = moment();
      const getAllUserSchedules = await databaseFramework.select(
        "appointments",
        "*",
        "patient_id = ? AND isConfirmed = 1 AND isFinished = 0 AND isDeleted = 0 AND date >=? ORDER BY date ASC",
        [patientId, currentDate.format('YYYY-MM-DD')]
      );
  
      if (getAllUserSchedules.length > 0) {
        const attendantIds = getAllUserSchedules.map((appointment) => appointment.professional_id);
  
        const getUserInfo = await databaseFramework.select("users", "*", "id IN(?)", [attendantIds]);
  
        const professionalMap = getUserInfo.reduce((map, user) => {
          map[user.id] = user;
          return map;
        }, {});
  
        const combinedSchedule = [];
  
        for (const appointment of getAllUserSchedules) {
          const appointmentEndTime = moment(util.addHoursToTime(appointment.start_time, 1), 'HH:mm');
    
          if (currentDate.isSameOrBefore(appointmentEndTime.subtract(1, 'minutes'))) {
            
            const locationInfo = [];
            const professional = professionalMap[appointment.professional_id];
            const userAppointments = await databaseFramework.select(
              "users_appointments",
              "*",
              "schedule_id = ? AND isInPerson = 1",
              [appointment.id]
            );

  
          for (const userAppointment of userAppointments) {
  
            const locationId = userAppointment.location_id;
  
            const locationData = await databaseFramework.select(
              "appointments_location",
              "*",
              "id = ?",
              [locationId]
            );
            if (locationData.length > 0) {
              locationInfo.push({
                locationId: locationData[0].id,
                locationName: locationData[0].name,
                locationAddress: locationData[0].address,
                locationNumber: locationData[0].number,
                locationComplement: locationData[0].complement,
                locationNeighborhood: locationData[0].neighborhood,
                locationPostalCode: locationData[0].postalCode,
                locationCity: await util.getCityNameById(locationData[0].cityId, this.connection),
                locationState: await util.getStateNameById(locationData[0].stateId, this.connection),
              });
            }
          }
  
          combinedSchedule.push({
            scheduleId: appointment.id,
            scheduleDate: util.formatDate(appointment.date),
            scheduleStartTime: appointment.start_time,
            scheduleEndTime: util.addHoursToTime(appointment.start_time, 1),
            scheduleMeetUrl: appointment.meetUrl,
            professionalId: professional.id,
            professionalName: professional.name,
            professionalRole: professional.role,
            professionalPhoto: `${professional.userPhoto}`,
            locationInfo: locationInfo,
          });
        }
      }
  
        return res.status(200).json(combinedSchedule);
      } else {
        return res.status(400).send();
      }
    }

    async verifySchedule(req, res) {
      const databaseFramework = new dbUtils(this.connection);
      const { date, patientId } = req.body;
  
      const dateParts = date.split("/");
      const year = parseInt(dateParts[2], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[0], 10);
  
      const convertedDate = new Date(year, month, day);
  
      const verifyIfUserHasSchedules = await databaseFramework.select("appointments", "*", "patient_id = ? and date = ? and isDeleted = 0", [patientId, convertedDate]);
      if (verifyIfUserHasSchedules.length > 0) {
  
        const appointments = [];
        await Promise.all(verifyIfUserHasSchedules.map(async (appointment) => {
          return appointments.push(appointment.start_time);
        }));
  
        return res.status(200).send(appointments);
      } else {
        return res.status(200).send([]);
      }
  
    }

    async listUnavailableHoursByLocation(req, res) {
      const databaseFramework = new dbUtils(this.connection);
      const { date, locationId } = req.body;
    
      const dateParts = date.split("/");
      const year = parseInt(dateParts[2], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[0], 10);
      const convertedDate = new Date(year, month, day);
    
      // Consulta a tabela attendant_schedule_availability para obter horários disponíveis
      const availableHoursQuery = await databaseFramework.select(
        "attendant_schedule_availability",
        "time",
        "DATE(date) = ? AND schedule_location_id = ? AND isInPerson = 1",
        [convertedDate, locationId]
      );
    
      // Crie um conjunto de horários disponíveis
      const availableHoursSet = new Set(availableHoursQuery.map((availability) => availability.time));
    
      // Crie um conjunto de todos os horários das 00:00 às 23:00
      const allHoursSet = new Set(Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00'));
    
      // Verifique se há registros em availableHoursQuery
      if (availableHoursQuery.length === 0) {
        return res.status(200).send(Array.from(allHoursSet));
      }
    
      // Consulta a tabela user_appointments para verificar se os horários estão lá com isInPerson = 1 e location_id correspondente
      const userAppointmentsQuery = await databaseFramework.select(
        "users_appointments",
        "schedule_id",
        "isInPerson = 1 AND location_id = ?",
        [locationId]
      );
    
      // Extraia o schedule_id do resultado
      const scheduleIds = userAppointmentsQuery.map((userAppointment) => userAppointment.schedule_id);
    
      // Verifique se há registros em scheduleIds
      if (scheduleIds.length === 0) {
        return res.status(200).send(Array.from(allHoursSet));
      }
    
      // Consulta a tabela appointments para verificar os horários indisponíveis com base nos schedule_ids
      const appointmentsQuery = await databaseFramework.select(
        "appointments",
        "start_time, id",
        "DATE(date) = ? AND isConfirmed = 1 AND id IN (?) AND isInPerson = 1",
        [convertedDate, scheduleIds]
      );
    
      // Determine os horários indisponíveis com base nos horários disponíveis na tabela attendant_schedule_availability
      const unavailableTimes = Array.from(allHoursSet).filter((startTime) => {
        const isTimeUnavailable = !availableHoursSet.has(startTime);
        const isTimeBooked = appointmentsQuery.some((appointment) => {
          return appointment.start_time === startTime && scheduleIds.includes(appointment.schedule_id);
        });
    
        return isTimeUnavailable || isTimeBooked;
      });
    
      if (unavailableTimes.length > 0) {
        return res.status(200).send(unavailableTimes);
      } else {
        return res.status(200).send([]);
      }
    }
    
    
    
    
    
    
    
    

    async listUnavailableHours(req, res) {
      const databaseFramework = new dbUtils(this.connection);
      const { date } = req.body;
    
      const dateParts = date.split("/");
      const year = parseInt(dateParts[2], 10);
      const month = parseInt(dateParts[1], 10) - 1;
      const day = parseInt(dateParts[0], 10);
      const convertedDate = new Date(year, month, day);
    
      // Consulta a tabela attendant_schedule_availability para obter horários disponíveis
      const availableHoursQuery = await databaseFramework.select(
        "attendant_schedule_availability",
        "time",
        "DATE(date) = ? AND isInPerson = 0",
        [convertedDate]
      );
    
      // Crie um conjunto de horários disponíveis
      const availableHoursSet = new Set(availableHoursQuery.map((availability) => availability.time));
    
      // Crie um conjunto de todos os horários das 00:00 às 23:00
      const allHoursSet = new Set(Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0') + ':00'));
    
      // Verifique se há registros em availableHoursQuery
      if (availableHoursQuery.length === 0) {
        return res.status(200).send(Array.from(allHoursSet));
      }
    
      // Consulta a tabela appointments para verificar os horários indisponíveis com base nos schedule_ids
      const appointmentsQuery = await databaseFramework.select(
        "appointments",
        "start_time, id",
        "DATE(date) = ? AND isConfirmed = 1 AND isInPerson = 0",
        [convertedDate]
      );
    
      // Determine os horários indisponíveis com base nos horários disponíveis na tabela attendant_schedule_availability
      const unavailableTimes = Array.from(allHoursSet).filter((startTime) => {
        const isTimeUnavailable = !availableHoursSet.has(startTime);
        const isTimeBooked = appointmentsQuery.some((appointment) => {
          return appointment.start_time === startTime && scheduleIds.includes(appointment.id);
        });
    
        return isTimeUnavailable || isTimeBooked;
      });
    
      if (unavailableTimes.length > 0) {
        return res.status(200).send(unavailableTimes);
      } else {
        return res.status(200).send([]);
      }
    }
    
    
    
    
    
    

      async getHoursByAttendants(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { date, startTime } = req.body;

        const dateParts = date.split("/");
        const year = parseInt(dateParts[2], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[0], 10);
    
        const convertedDate = new Date(year, month, day);
        try {
          const getChatAttendants = await databaseFramework.select("chat_attendants", "*");
          if (getChatAttendants.length <= 0) { return res.status(404).json({ message: 'Não há atendentes disponíveis.' }); }
    
          const attendantIds = getChatAttendants.map(attendant => attendant.attendant_id);
          const getProfessionalData = await databaseFramework.select("appointments", "*", "professional_id IN (?) and date = ? and start_time = ? and isConfirmed = 1 and isFinished = 0", [attendantIds, convertedDate, startTime]);
    
          if (getProfessionalData.length <= 0) {
    
            const getUserData = await databaseFramework.select("users", "*", "id IN (?)", [attendantIds]);
    
            const userData = getUserData.map(user => {
              return {
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                userPhoto: `${user.userPhoto}`
              }
            });
    
    
            return res.status(200).send(userData);
          }
    
          return res.status(400).send();
    
        } catch (error) {
          return res.status(500).send({ message: error.message });
        }
      }

      async acceptPendingSchedule(req, res) {
        const { attendantId, scheduleId } = req.body;
        const databaseFramework = new dbUtils(this.connection);

        try {
            const getScheduleData = await databaseFramework.select("appointments", "*", "id = ? and professional_id = ?", [scheduleId, attendantId]);
            const scheduledData = getScheduleData[0];

            if (scheduledData.isConfirmed === 1) {
                return res.status(409).json({ message: 'Agendamento já foi confirmado.' });
            }

            await databaseFramework.update("appointments", { isConfirmed: 1 }, `id = ${scheduleId}`);
            await databaseFramework.update("users_appointments", { isConfirmed: 1 }, `schedule_id = ${scheduleId}`);
            return res.status(200).json({ message: 'Agendamento confirmado.' });

        } catch (error) {
            return res.status(500).json({ message: error.message });
        }

    }

    async syncLinkToSchedule(req, res) {
      const { scheduleId, meetUrl } = req.body;
      const databaseFramework = new dbUtils(this.connection);

      if (!util.validaURL(meetUrl) || !meetUrl.includes('meet')) { return res.status(400).json({ message: 'Link inválido.' }); }
      try {
        const getScheduleData = await databaseFramework.select("appointments", "*", "id = ? and isDeleted = 0", [scheduleId]);
        if (getScheduleData.length <= 0) { return res.status(404).json({ message: 'Agendamento não encontrado.' }); }
        
        const getUserScheduleData = await databaseFramework.select("users_appointments", "*", "schedule_id = ? and isOnline = 1", [scheduleId]);
        if (getUserScheduleData.length <= 0) { return res.status(404).json({ message: 'Agendamento não encontrado.' }); }

        const scheduleData = getScheduleData[0];
        if (scheduleData.isConfirmed === 0) { return res.status(409).json({ message: 'Agendamento não foi confirmado' }); }
        if (scheduleData.isFinished === 1) { return res.status(409).json({ message: 'Agendamento já foi concluído' }); }

        await databaseFramework.update("appointments", { meetUrl: meetUrl }, `id = ${scheduleId}`);
        return res.status(200).json({ message: 'Agendamento atualizado com sucesso' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    
    }

    async listSchedulesPending(req, res) {
      try {
        const { attendantId } = req.body;
        const databaseFramework = new dbUtils(this.connection);
    
        const getSchedules = await databaseFramework.select(
          "appointments",
          ["patient_id", "date", "start_time", "id", "meetUrl"],
          "isConfirmed = 0 and professional_id = ?",
          [attendantId]
        );
    
        if (getSchedules.length === 0) {
          return res.status(200).json([]);
        }
    
        const patientDataPromises = getSchedules.map(async (schedule) => {

          const [getPatientData, getUserScheduleData, userAppointments] = await Promise.all([
            databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id = ?", [schedule.patient_id]),
            databaseFramework.select("users_appointments", ["isOnline"], "schedule_id = ?", [schedule.id]),
            databaseFramework.select("users_appointments", "*", "schedule_id = ? AND isInPerson = 1", [schedule.id])
          ]);
    
          const locationInfoPromises = userAppointments.map(async (userAppointment) => {
            const locationId = userAppointment.location_id;
            const locationData = await databaseFramework.select("appointments_location", "*", "id = ?", [locationId]);
    
            if (locationData.length > 0) {
              return {
                locationId: locationData[0].id,
                locationName: locationData[0].name,
                locationAddress: locationData[0].address,
                locationNumber: locationData[0].number,
                locationComplement: locationData[0].complement,
                locationNeighborhood: locationData[0].neighborhood,
                locationPostalCode: locationData[0].postalCode,
                locationCity: await util.getCityNameById(locationData[0].cityId, this.connection),
                locationState: await util.getStateNameById(locationData[0].stateId, this.connection),
              };
            }
          });
    
          const locationInfo = await Promise.all(locationInfoPromises);
    
          if (getPatientData.length > 0) {
            const patient = getPatientData[0];
            return {
              patientId: patient.id,
              patientName: patient.name,
              patientPhoto: `${patient.userphoto}`,
              scheduleId: schedule.id,
              scheduleDate: util.convertDateToCustomFormat(schedule.date),
              scheduleStartTime: schedule.start_time,
              scheduleIsOnline: getUserScheduleData[0].isOnline,
              scheduleMeetUrl: schedule.meetUrl,
              locationInfo: locationInfo.filter((info) => info !== undefined),
            };
          }
        });
    
        const patientData = await Promise.all(patientDataPromises);
    
        return res.status(200).json(patientData);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

  async listSchedulesConfirmed(req, res) {
      const { attendantId } = req.body;
      const databaseFramework = new dbUtils(this.connection);
      try {
    
        const getSchedules = await databaseFramework.select(
          "appointments",
          ["patient_id", "date", "start_time", "id", "meetUrl"],
          "isConfirmed = 1 and professional_id = ?",
          [attendantId]
        );
    
        if (getSchedules.length === 0) {
          return res.status(200).json([]);
        }
    
        const patientDataPromises = getSchedules.map(async (schedule) => {

          const [getPatientData, getUserScheduleData, userAppointments] = await Promise.all([
            databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id = ?", [schedule.patient_id]),
            databaseFramework.select("users_appointments", ["isOnline"], "schedule_id = ?", [schedule.id]),
            databaseFramework.select("users_appointments", "*", "schedule_id = ? AND isInPerson = 1", [schedule.id])
          ]);
    
          const locationInfoPromises = userAppointments.map(async (userAppointment) => {
            const locationId = userAppointment.location_id;
            const locationData = await databaseFramework.select("appointments_location", "*", "id = ?", [locationId]);
    
            if (locationData.length > 0) {
              return {
                locationId: locationData[0].id,
                locationName: locationData[0].name,
                locationAddress: locationData[0].address,
                locationNumber: locationData[0].number,
                locationComplement: locationData[0].complement,
                locationNeighborhood: locationData[0].neighborhood,
                locationPostalCode: locationData[0].postalCode,
                locationCity: await util.getCityNameById(locationData[0].cityId, this.connection),
                locationState: await util.getStateNameById(locationData[0].stateId, this.connection),
              };
            }
          });
    
          const locationInfo = await Promise.all(locationInfoPromises);
    
          if (getPatientData.length > 0) {
            const patient = getPatientData[0];
            return {
              patientId: patient.id,
              patientName: patient.name,
              patientPhoto: `${patient.userphoto}`,
              scheduleId: schedule.id,
              scheduleDate: util.convertDateToCustomFormat(schedule.date),
              scheduleStartTime: schedule.start_time,
              scheduleIsOnline: getUserScheduleData[0].isOnline,
              scheduleMeetUrl: schedule.meetUrl,
              locationInfo: locationInfo.filter((info) => info !== undefined),
            };
          }
        });
    
        const patientData = await Promise.all(patientDataPromises);
    
        return res.status(200).json(patientData);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
  }
  

}

module.exports = ScheduleFunctions;