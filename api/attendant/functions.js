const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemObjects = require('../system/systemObjects.js');
const systemMessages = require('../system/systemMessages.js');
const dbUtils = require('../util/databaseUtils.js');
class Functions {

  constructor(connection) {
    this.connection = connection;
  }

  async create(req, res) {
    const { name, email, phone, birthdate, gender, role, registerNumber, cpf, rg, ocupationArea, password } = req.body;
    const uniqueid = uuidv4();
    const databaseFramework = new dbUtils(this.connection);

    if (!util.isPhoneNumber(phone)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_PHONE_NUMBER.message }); }
    if (!util.isInteger(gender)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_GENDER.message }); }
    if (!util.isEmail(email)) { return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

    const getUserByMail = await databaseFramework.select("users", "*", "email = ?", [email]);

    if (getUserByMail.length > 0) { return res.status(409).send({ message: systemMessages.ErrorMessages.EMAIL_ALREADY_EXISTS.message }); }

    const formattedPhone = util.formatPhoneNumber(phone);
    const formattedBirthDate = util.formatToDate(birthdate);

    const createAttendant = await databaseFramework.insert("users", { uniqueid: uniqueid, name: name, email: email, password: util.convertToSHA256(password), usertype: systemObjects.UserTypes.ATENDENTE.id, phone: formattedPhone, birthdate: formattedBirthDate, gender: gender, role: role, registerNumber: registerNumber, cpf: cpf, rg: rg, ocupationArea: ocupationArea });
    await databaseFramework.insert("attendant_aprove", { attendant_id: createAttendant, isApproved: 0 });
    return res.status(200).send({ message: 'Profissional/Atendente criado com sucesso!', userUniqueId: uniqueid });
  }

  async approveAttendant(req, res) {
    const { attendantId } = req.body;
    const databaseFramework = new dbUtils(this.connection);
    try {
      const getUserData = await databaseFramework.select("users", "*", "id = ? and usertype >= 2", [attendantId]);
      if (getUserData.length === 0) {
        return res.status(409).send({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
      }

      const userData = getUserData[0];
      if (userData.isApproved === 1) {
        return res.status(409).send({ message: 'Este atendente já foi aprovado.' });
      }

      await databaseFramework.update("attendant_approve", { isApproved: 1 }, "attendant_id =?", [userData.id]);
      return res.status(200).send({ message: 'Atendente aprovado com sucesso!' });
    } catch (error) {
      return res.status(500).send({ message: 'Erro ao aprovar atendente.' });
    }
  }

  // async getAttendantApprovalStatus(req, res) {
  //   const { attendantId } = req.body;
  //   const databaseFramework = new dbUtils(this.connection);

  //   try {

  //   } catch (error) {
  //     return res.status(500).send({ message: 'Erro ao pegar status atual da aprovação do atendente.' });
  //   }

  // }

  async alterAttendantData(req, res) {
    const { name, email, phone, birthdate, gender, role, registerNumber, cpf, rg, ocupationArea, password, userUniqueId } = req.body;
    const databaseFramework = new dbUtils(this.connection);

    const getUserData = await databaseFramework.select("users", "*", "uniqueid = ? and usertype >=2", [userUniqueId]);
    if (getUserData.length === 0) {
      return res.status(409).send({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message });
    }
    const currentUserData = getUserData[0];
    const updatedData = {};
    let hasChanges = false;

    const fieldsToUpdate = {
      name, email, phone, birthdate, gender, role, registerNumber, cpf, rg, ocupationArea, password
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
        hasChanges = true;
      }
    }

    if (!hasChanges) {
      return res.status(400).send({ message: 'Nenhum campo alterado.' });
    }
    await databaseFramework.update("users", updatedData, `id = ${currentUserData.id}`);
    return res.status(200).send({ message: 'Dados alterados com sucesso.' });
  }




}
module.exports = Functions;