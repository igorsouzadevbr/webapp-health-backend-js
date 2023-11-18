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
    const { name, email, phone, birthdate, gender, role, registerNumber, password } = req.body;
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
    await databaseFramework.insert("users", { uniqueid: uniqueid, name: name, email: email, password: util.convertToSHA256(password), usertype: systemObjects.UserTypes.PROFISSIONAL.id, phone: formattedPhone, birthdate: formattedBirthDate, gender: gender, role: role, registerNumber: registerNumber });
    return res.status(200).send({ message: 'Profissional/Atendente criado com sucesso!', userUniqueId: uniqueid });
  }

  async getSchedules() {

  }

}
module.exports = Functions;