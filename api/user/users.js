const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const jwt = require('jsonwebtoken');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');
class Users {
  constructor(connection) {
    this.connection = connection;
  }



  async verifyLogin(req, res, keyUseAPI) {
    const { email, password } = req.body;
    const cryptoPass = util.convertToSHA256(password);
    const ip = req.headers['x-forwarded-for'] || req.ip;
    const databaseFramework = new dbUtils(this.connection);

    const userData = await databaseFramework.select("users", "*", "email = ?", [email]);
    if (userData.length === 0) { return res.status(401).send({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    const userId = userData[0].id;
    const userPunishments = await databaseFramework.select("users_punishments", "*", "userid = ?"[userId]);

    if (userPunishments.length > 0) {
      if (userPunishments[0].isblocked == 1) { return res.status(429).send({ message: systemMessages.ErrorMessages.BLOCKED_TOO_MUCH_TRIES.message, blockreason: userPunishments[0].blockedreason }); }


      if (userPunishments[0].isbanned == 1) {
        const bannedDate = userPunishments[0].banneddate;
        const data = new Date(bannedDate);

        const dia = String(data.getDate()).padStart(2, '0');
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const ano = data.getFullYear();
        const horas = String(data.getHours()).padStart(2, '0');
        const minutos = String(data.getMinutes()).padStart(2, '0');

        const dataFormatada = `${dia}/${mes}/${ano} ás ${horas}:${minutos}`;
        return res.status(429).send({ message: systemMessages.ErrorMessages.BANNED_USER_MESSAGE.message, bannedreason: userPunishments[0].bannedreason, banneddate: dataFormatada });
      }
    }
    const userLoginAttempts = await databaseFramework.select("login_attempts", "*", "ip = ? and userid = ?", [ip, userId]);
    const timestampNow = new Date();

    let exists = userLoginAttempts.length > 0;
    let timestamp = exists ? userLoginAttempts[0].timestamp : timestampNow;

    const diffMinutos = (timestampNow - new Date(timestamp)) / 1000 / 60;

    if (exists && diffMinutos < 5 && userLoginAttempts[0].tries <= 3) {
      await databaseFramework.update("login_attempts", { tries: userLoginAttempts[0].tries + 1 }, `ip = '${ip}' and userid = ${userId}`);
      let tentativa = '';
      if (userLoginAttempts[0].tries == 1) { tentativa = 'segunda' };
      if (userLoginAttempts[0].tries == 2) { tentativa = 'terceira' };
      if (userLoginAttempts[0].tries == 3) { tentativa = 'quarta' };
      if (userLoginAttempts[0].tries == 4) { tentativa = 'quinta' };
      if (tentativa == 'quarta') { return res.status(429).send({ message: 'ATENÇÃO: Dados incorretos! Essa é a sua ' + tentativa + ' tentativa. Caso você erre mais uma vez, seu usuário será bloqueado.' }); }
      return res.status(429).send({ message: 'Dados incorretos! Essa é a sua ' + tentativa + ' tentativa. Caso você atinja 5 tentativas, seu usuário será bloqueado.' });
    }

    //bloquear usuário
    if (exists && diffMinutos < 5 && userLoginAttempts[0].tries > 3) {

      if (userPunishments.length === 0) {
        await databaseFramework.insert("users_punishments", { userid: userId, isBlocked: 1, blockedReason: 'Excesso de tentativas de login.', blockedDate: timestampNow });
      }
      else { await databaseFramework.update("users_punishments", { isblocked: 1, blockedreason: 'Excesso de tentativas de login.', blockeddate: timestampNow }, `userid = ${userId}`); }
      return res.status(429).send({ message: systemMessages.ErrorMessages.BLOCKED_TOO_MUCH_TRIES.message });
    }

    const verifyUserLoginData = await databaseFramework.select("users", "*", "email = ? and password = ?", [email, cryptoPass]);
    if (verifyUserLoginData.length === 0) {
      if (exists) {
        if (diffMinutos < 5) {
          await databaseFramework.update("login_attempts", { tries: tries + 1 }, `ip = ${ip} and userid = ${userId}`);
        } else {
          await databaseFramework.update("login_attempts", { timestamp: timestampNow, tries: 1 }, `ip = ${ip} and userid = ${userId}`);
        }
      } else {
        await databaseFramework.insert("login_attempts", { userid: userId, ip: ip, timestamp: timestampNow, tries: 1 });
      }
      return res.status(401).send({ message: systemMessages.ErrorMessages.INCORRECT_USER.message });
    } else {
      const getUserLocation = await databaseFramework.select("location", "*", "personid = ?", [userData[0].id]);
      const userLocationData = getUserLocation[0];
      const token = jwt.sign({ userEmail: email, userUniqueId: userData[0].uniqueid, userId: userData[0].id, userType: userData[0].usertype, userPostalCode: userLocationData.postalcode }, keyUseAPI, { expiresIn: '96h' });

      const uniqueid = uuidv4();
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'verifyLogin: ' + JSON.stringify(verifyUserLoginData),
        status: 200
      }, this.connection);
      if (userData[0].usertype === systemObjects.UserTypes.ATENDENTE.id || userData[0].usertype === systemObjects.UserTypes.PROFISSIONAL.id) {
        const verifyIfAttendantIsOnTable = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [userData[0].id]);
        if (verifyIfAttendantIsOnTable.length <= 0) {
          await databaseFramework.insert("chat_attendants", { attendant_id: userData[0].id, category_id: 1, isAvailable: 0, isAll: 0, isOnChat: 0 });
        }
      }
      return res.status(200).send({ message: 'Login realizado com sucesso.', token: token, expiresIn: 3 });
    }

  }

  async unBlockUser(req, res) {
    const { email } = req.body;
    const databaseFramework = new dbUtils(this.connection);

    if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    const userData = await databaseFramework.select("users", "*", "email = ?", [email]);
    if (userData.length <= 0) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }
    const isUserBlocked = await databaseFramework.select("users_punishments", "*", "userid = ?", [userData[0].id]);
    if (isUserBlocked[0].isblocked == 0 || isUserBlocked.length <= 0) {
      return res.status(409).json({ message: "Este usuário não está bloqueado." });
    }
    await databaseFramework.update("users_punishments", { isblocked: 0, blockeddate: null }, `userid = ${userData[0].id}`);
    await databaseFramework.delete("login_attempts", `userid = ${userData[0].id}`);
    return res.status(200).json({ message: 'Usuário desbloqueado com sucesso.' });
  }

  async unBanUser(req, res) {
    const { email } = req.body;
    const databaseFramework = new dbUtils(this.connection);

    if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    const userData = await databaseFramework.select("users", "*", "email = ?", [email]);
    if (userData.length <= 0) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }
    const isUserBanned = await databaseFramework.select("users_punishments", "*", "userid = ?", [userData[0].id]);
    if (isUserBanned[0].isbanned == 0 || isUserBanned.length <= 0) {
      return res.status(409).json({ message: "Este usuário não está banido." });
    }
    await databaseFramework.update("users_punishments", { isbanned: 0, banneddate: null }, `userid = ${userData[0].id}`);
    return res.status(200).json({ message: 'Usuário desbanido com sucesso.' });
  }

  async verifyUserEmail(req, res) {
    const { email } = req.body;
    if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    const databaseFramework = new dbUtils(this.connection);
    const userMail = await databaseFramework.select("users", "email", "email = ?", [email]);
    if (userMail.length >= 1) { return res.status(401).json({ message: systemMessages.ErrorMessages.EMAIL_ALREADY_EXISTS.message }); }
    return res.status(200).json({ message: 'E-mail inexistente.' });
  }

  async getUserData(req, res) {
    const { email, userUniqueId } = req.body;
    const databaseFramework = new dbUtils(this.connection);
    if (email == null || !util.isEmail(email)) {
      return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message });
    }

    const userDataByEmail = await databaseFramework.select("users", "id, uniqueid, name, email, phone, birthdate, gender, userphoto, password, usertype", "email = ? and uniqueid = ?", [email, userUniqueId]);
    if (userDataByEmail.length === 0) {
      return res.status(404).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
    }

    const imageBuffer = userDataByEmail[0].userphoto; // Supondo que userphoto contenha a imagem em formato Blob
    const imageUrl = imageBuffer === null ? null : `${imageBuffer}`;

    const decryptedPassword = util.decryptSHA256(userDataByEmail[0].password);
    const userData = { ...userDataByEmail[0], password: decryptedPassword, userphoto: imageUrl };

    const uniqueid = uuidv4();
    util.logToDatabase({
      uniqueid: uniqueid,
      ip: req.ip,
      method: 'GET',
      message: 'getUserData: ' + JSON.stringify(userData[0]) + ' - 2023',
      status: 200
    }, this.connection);
    return res.status(200).json(userData);
  }

  async getUserAddressData(req, res) {
    const { email } = req.body;
    const databaseFramework = new dbUtils(this.connection);
    if (email == null || !util.isEmail(email)) {
      return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message });
    }
    const userDataByEmail = await databaseFramework.select("users", "id", "email = ?", [email]);
    if (userDataByEmail.length === 0) {
      return res.status(404).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
    }
    const userAddressData = await databaseFramework.select("location", "address, number, complement, neighborhood, postalcode, cityId, stateId, isDeleted", "personid = ?", [userDataByEmail[0].id]);
    const getUserCityData = await databaseFramework.select("city", "name", "id = ?", [userAddressData[0].cityId]);
    const getUserStateData = await databaseFramework.select("states", "nome", "id = ?", [userAddressData[0].stateId]);
    const userLocationData = { ...userAddressData[0], cityName: getUserCityData[0].name, stateName: getUserStateData[0].nome };
    const uniqueid = uuidv4();
    util.logToDatabase({
      uniqueid: uniqueid,
      ip: req.ip,
      method: 'GET',
      message: 'getUserData: ' + JSON.stringify(userLocationData) + ' - 2023',
      status: 200
    }, this.connection);
    return res.status(200).json(userLocationData);
  }

  async alterUserData(req, res) {
    const { name, email, phone, birthdate, gender, password, userUniqueId } = req.body;
    const databaseFramework = new dbUtils(this.connection);

    const getUserData = await databaseFramework.select("users", "*", "uniqueid = ?", [userUniqueId]);
    if (getUserData.length === 0) {
      return res.status(409).send({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
    }
    const currentUserData = getUserData[0];
    const updatedData = {};
    let hasChanges = false;

    const fieldsToUpdate = {
      name, email, phone, birthdate, gender, password
    }
    for (const field in fieldsToUpdate) {
      if (fieldsToUpdate[field] && fieldsToUpdate[field] !== currentUserData[field]) {
        if (field === 'password' && currentUserData['password'] != await util.convertToSHA256(password)) {
          const hashedPassword = await util.convertToSHA256(fieldsToUpdate[field]);
          fieldsToUpdate[field] = hashedPassword;
        }
        if (field === 'password' && currentUserData['password'] == await util.convertToSHA256(password)) {
          const hashedPassword = await util.convertToSHA256(fieldsToUpdate[field]);
          fieldsToUpdate[field] = hashedPassword;
        }
        if (field === 'email') {
          if (!util.isEmail(email)) {
            return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message });
          }
        }
        if (field === 'phone' && currentUserData[field] != await util.formatPhoneNumber(phone)) {
          if (!util.isPhoneNumber(phone)) {
            return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_PHONE_NUMBER.message });
          }
          fieldsToUpdate[field] = util.formatPhoneNumber(fieldsToUpdate[field]);
        }
        if (field === 'gender' && currentUserData[field] != gender) {
          if (!util.isInteger(gender)) {
            return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_GENDER.message });
          }
        }
        if (field === 'birthdate' && currentUserData[field] != await util.formatToDate(birthdate)) {
          fieldsToUpdate[field] = util.formatToDate(fieldsToUpdate[field]);
        }
        updatedData[field] = fieldsToUpdate[field];
        console.log(updatedData[field]);
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      return res.status(400).send({ message: 'Nenhum campo alterado.' });
    }
    await databaseFramework.update("users", updatedData, `id = ${currentUserData.id}`);
    return res.status(200).send({ message: 'Dados alterados com sucesso.' });
  }

  async create(req, res) {
    const { name, email, phone, birthdate, gender, password } = req.body;
    const uniqueid = uuidv4();
    const databaseFramework = new dbUtils(this.connection);

    if (!util.isPhoneNumber(phone)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_PHONE_NUMBER.message }); }
    if (!util.isInteger(gender)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_GENDER.message }); }
    if (!util.isEmail(email)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    const getUserByMail = await databaseFramework.select("users", "*", "email = ?", [email]);

    if (getUserByMail.length > 0) { return res.status(409).send({ message: systemMessages.ErrorMessages.EMAIL_ALREADY_EXISTS.message }); }

    const formattedPhone = util.formatPhoneNumber(phone);
    const formattedBirthDate = util.formatToDate(birthdate);

    // Inserção do usuário no banco de dados
    await databaseFramework.insert("users", { uniqueid: uniqueid, name: name, email: email, password: util.convertToSHA256(password), usertype: systemObjects.UserTypes.PACIENTE.id, phone: formattedPhone, birthdate: formattedBirthDate, gender: gender });
    return res.status(200).send({ message: 'Usuário criado com sucesso!', userUniqueId: uniqueid });
  }

  async insertUserPhoto(req, res) {
    const { userUniqueId, pictureBlob } = req.body;
    const databaseFramework = new dbUtils(this.connection);

    // Verifique se a pictureBlob é uma string base64 válida
    const base64Regex = /^data:image\/\w+;base64,/;
    if (!base64Regex.test(pictureBlob)) {
      return res.status(409).json({ message: systemMessages.ErrorMessages.INVALID_BLOB.message });
    }
    const userData = await databaseFramework.select("users", "*", "uniqueid = ?", [userUniqueId]);
    if (userData.length <= 0) { return res.status(409).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message }); }
    await databaseFramework.update("users", { userPhoto: pictureBlob }, `id = ${userData[0].id}`);
    return res.status(200).json({ message: 'Foto de perfil atualizada com sucesso.' });
  }

  //LOCATION DATA
  async createLocation(req, res) {
    const { address, number, complement, neighborhood, cityId, stateId, postalCode, userUniqueId } = req.body;
    const uniqueid = uuidv4();
    const databaseFramework = new dbUtils(this.connection);

    try {
      if (!await util.validateStateById(stateId, this.connection)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_CITY.message }); }
    } catch (error) {
      console.error('Erro ao validar o estado:', error);
      return res.status(500).send({ message: 'Erro ao validar o estado' });
    }

    try {
      if (!await util.validateCityById(cityId, this.connection)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_CITY.message }); }
    } catch (error) {
      console.error('Erro ao validar a cidade:', error);
      return res.status(500).send({ message: 'Erro ao validar a cidade' });
    }

    try {
      if (!await util.validaCEP(postalCode, this.connection)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_POSTAL_CODE.message }); }
    } catch (error) {
      console.error('Erro ao validar o CEP:', error);
      return res.status(500).send({ message: 'Erro ao validar o CEP.' });
    }

    const getUserIdFromUniqueId = await databaseFramework.select("users", "id", "uniqueid = ? and isDeleted = 0", [userUniqueId]);

    if (getUserIdFromUniqueId.length === 0) { return res.status(409).send({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message }); }

    const userId = getUserIdFromUniqueId[0].id;
    const getUserLocation = await databaseFramework.select("location", "*", "personid = ? and isDeleted = 0", [userId]);
    if (getUserLocation.length > 0) {
      const locationData = getUserLocation[0];
      await databaseFramework.update("location", { address: address, number: number, complement: complement, neighborhood: neighborhood, postalcode: postalCode, cityId: cityId, stateId: stateId }, `id = ${locationData.id}`);
      return res.status(200).send({ message: 'Endereço atualizado com sucesso.', addressUniqueId: uniqueid });
    }

    const insertUserLocation = await databaseFramework.insert("location", { uniqueid: uniqueid, personid: userId, address: address, number: number, complement: complement, neighborhood: neighborhood, postalcode: postalCode, cityId: cityId, stateId: stateId });

    //atualizar endereço no cadastro do usuário
    const generatedLocationId = insertUserLocation.insertId;
    await databaseFramework.update("users", { locationid: generatedLocationId }, `id = ${userId}`);
    return res.status(200).send({ message: 'Endereço cadastrado com sucesso.', addressUniqueId: uniqueid });

  }

  async listUnavailableHours(req, res) {
    const databaseFramework = new dbUtils(this.connection);
    const { date } = req.body;

    const dateParts = date.split("/");
    const year = parseInt(dateParts[2], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[0], 10);
    const convertedDate = new Date(year, month, day);

    const attendantsQuery = await databaseFramework.select("chat_attendants", "attendant_id", "isAvailable = 1");
    if (attendantsQuery.length === 0) {
      return res.status(400).send({ message: 'Não há atendentes registrados.' });
    }
    const attendantQuantity = attendantsQuery.length;
    const unavailableAttendantsByHour = await databaseFramework.select("appointments", "*", "date = ?", [convertedDate]);

    const unavailableAttendantsData = unavailableAttendantsByHour.map(professional => {
      return {
        professionalId: professional.professional_id,
        startTime: professional.start_time
      }
    }
    ).reduce((acc, attendant) => {
      const existingEntry = acc.find(
        (entry) => entry.startTime === attendant.startTime
      );

      if (existingEntry) existingEntry.count++;
      else acc.push({ startTime: attendant.startTime, count: 1 });

      return acc;
    }, [])
      .filter((entry) => entry.count === attendantQuantity)
      .map((result) => {
        if (result.count === attendantQuantity) return result.startTime;
      });

    if (unavailableAttendantsData.length > 0) {
      return res.status(200).send(unavailableAttendantsData);
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
      const getChatAttendants = await databaseFramework.select("chat_attendants", "*", "isAvailable = 1");
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

  async listSchedules(req, res) {
    const databaseFramework = new dbUtils(this.connection);
    const { patientId } = req.body;

    const getAllUserSchedules = await databaseFramework.select("appointments", "*", "patient_id = ? and isConfirmed = 1 and isFinished = 0", [patientId]);

    if (getAllUserSchedules.length > 0) {
      const attendantIds = getAllUserSchedules.map(appointment => appointment.professional_id);

      const getUserInfo = await databaseFramework.select("users", "*", "id IN(?)", [attendantIds]);

      const professionalMap = getUserInfo.reduce((map, user) => {
        map[user.id] = user;
        return map;
      }, {});

      const combinedSchedule = getAllUserSchedules.map(appointment => {
        const professional = professionalMap[appointment.professional_id];
        return {
          scheduleDate: util.formatDate(appointment.date),
          scheduleStartTime: appointment.start_time,
          scheduleEndTime: util.addHoursToTime(appointment.start_time, 1),
          professionalName: professional.name,
          professionalRole: professional.role,
          professionalPhoto: `${professional.userPhoto}`
        };
      });

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

    const verifyIfUserHasSchedules = await databaseFramework.select("appointments", "*", "patient_id = ? and date = ?", [patientId, convertedDate]);
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

  async createSchedule(req, res) {
    const databaseFramework = new dbUtils(this.connection);
    const { patientId, professionalId, isOnline, date, startTime, locationId } = req.body;

    const dateParts = date.split("/");
    const year = parseInt(dateParts[2], 10);
    const month = parseInt(dateParts[1], 10) - 1;
    const day = parseInt(dateParts[0], 10);

    const convertedDate = new Date(year, month, day);

    try {

      const verifyProfessionalAppointments = await databaseFramework.select("appointments", "*", "professional_id = ? and date = ? and start_time = ? and isConfirmed = 1 and isFinished = 0", [professionalId, convertedDate, startTime]);
      if (verifyProfessionalAppointments.length === 1) {
        return res.status(409).send({ message: 'Este profissional já possui um agendamento para esta data e horário. Escolha outra.' });
      }

      const createSchedule = await databaseFramework.insert("appointments", { patient_id: patientId, professional_id: professionalId, date: convertedDate, start_time: startTime, isConfirmed: 0 });

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

}

module.exports = Users;