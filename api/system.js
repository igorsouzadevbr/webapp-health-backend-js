const util = require('./util/util');
const systemMessages = require('./system/systemMessages.js');
const dbUtils = require('./util/databaseUtils.js');
class System {
  constructor(connection) {
    this.connection = connection;
  }

  async getUserTypes(req, res) {
    const databaseFramework = new dbUtils(this.connection);
    const userTypeData = await databaseFramework.select("usertype", "*");
    if (userTypeData.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ userTypeData });
  }
  async getCityByID(req, res) {
    const cityid = req.params.cityid;
    const databaseFramework = new dbUtils(this.connection);

    const getCities = await databaseFramework.select("city", "*", "id = ?", [cityid]);
    if (getCities.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getCities });

  }
  async getCityByName(req, res) {
    const cityname = req.params.cityname;
    const databaseFramework = new dbUtils(this.connection);

    const getCities = await databaseFramework.select("city", "*", "name = ?", [cityname]);
    if (getCities.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getCities });
  }
  async getStateByID(req, res) {
    const stateid = req.params.stateid;
    const databaseFramework = new dbUtils(this.connection);

    const getStates = await databaseFramework.select("states", "*", "id = ?", [stateid]);
    if (getStates.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getStates });
  }
  async getStateByAb(req, res) {
    const stateab = req.params.stateab;
    const databaseFramework = new dbUtils(this.connection);

    const getStates = await databaseFramework.select("states", "*", "tag = ?", [stateab]);
    if (getStates.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getStates });
  }
  async getStateByName(req, res) {
    const statename = req.params.statename
    const databaseFramework = new dbUtils(this.connection);

    const getStates = await databaseFramework.select("states", "*", "name = ?", [statename]);
    if (getStates.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getStates });
  }
  async getGenderByID(req, res) {
    const genderid = req.params.genderid;
    const databaseFramework = new dbUtils(this.connection);

    const getGenders = await databaseFramework.select("gender", "*", "id = ?", [genderid]);
    if (getGenders.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getGenders });
  }
  async getGenderByName(req, res) {
    const gendername = req.params.gendername;
    const databaseFramework = new dbUtils(this.connection);

    const getGenders = await databaseFramework.select("gender", "*", "Name = ?", [gendername]);
    if (getGenders.length === 0) {
      return res.status(404).json({ message: 'Sem resultados.' });
    }
    return res.status(200).send({ getGenders });
  }

  async getPostalCode(req, res) {
    const postalcode = req.params.postalcode;
    const sanitizedPostalCode = postalcode.replace(/\D/g, '');
    try {
      const cepDetails = await util.validaCEP(sanitizedPostalCode);

      if (!cepDetails.valido) {
        return res.status(409).send({ message: systemMessages.ErrorMessages.INCORRECT_POSTAL_CODE.message });
      }

      const { valido, ...cepData } = cepDetails;
      res.status(200).send({ message: cepData });
      const { v4: uuidv4 } = require('uuid');
      const uniqueid = uuidv4();
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'getPostalCode: ' + JSON.stringify(cepData),
        status: 200
      }, this.connection);
    } catch (error) {
      res.status(500).send({ message: 'Erro ao buscar detalhes do CEP.', error });
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'ERRO: getPostalCode: ' + JSON.stringify(error),
        status: 500
      }, this.connection);
    }
  }
}
module.exports = System;