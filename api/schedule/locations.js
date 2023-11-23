const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');
class Users {
    constructor(connection) {
        this.connection = connection;
    }

    async cancelSchedule(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { scheduleId, patientId } = req.body;
        try {
            const verifyIfScheduleExists = await databaseFramework.select("appointments", "*", "id = ? and patient_id = ? and isDeleted = 0", [scheduleId, patientId]);
            if (verifyIfScheduleExists.length === 0) {
                return res.status(404).send({ message: 'Agendamento não encontrado.' });
            }
            await databaseFramework.update("appointments", { isDeleted: 1 }, "id = ?", [scheduleId]);
            return res.status(200).send({ message: 'Agendamento cancelado com sucesso.' });
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }

    }
    async getLocation(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { postalCode } = req.body;
        const sanitizedPostalCode = postalCode.replace(/\s/g, '');

        const exactLocation = await databaseFramework.select("appointments_location", "*", "postalCode = ? and isDeleted = 0", [sanitizedPostalCode]);
        let allLocations = [];

        if (exactLocation.length > 0) {
            allLocations = exactLocation;
        } else {
            const similarLocations = await databaseFramework.select("appointments_location", "*", "postalCode LIKE ? and isDeleted = 0", [`${sanitizedPostalCode.slice(0, 5)}%`]);

            if (similarLocations.length > 0) {
                allLocations = similarLocations;
            }
        }

        if (allLocations.length > 0) {
            allLocations.forEach(location => {
                location.image = `${location.image}`;
            });
            return res.status(200).send(allLocations);
        } else {
            return res.status(404).send({ message: 'Localização não encontrada.' });
        }
    }




    async createLocation(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { name, address, number, complement, neighborhood, cityId, stateId, postalCode, pictureBlob } = req.body;
        const sanitizedPostalCode = postalCode.replace(/\s/g, '');

        if (pictureBlob) {
            const base64Regex = /^data:image\/\w+;base64,/;
            if (!base64Regex.test(pictureBlob)) {
                return res.status(409).json({ message: systemMessages.ErrorMessages.INVALID_BLOB.message });
            }
        }

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
        try {
            const verifyLocation = await databaseFramework.select("appointments_location", "*", "name = ? and address = ? and number = ? and postalcode = ? and isDeleted = 0", [name, address, number, sanitizedPostalCode]);
            if (verifyLocation.length > 0) {
                return res.status(400).json({ message: 'Endereço já está cadastrado.' });
            }
            await databaseFramework.insert("appointments_location", { name: name, address: address, number: number, complement: complement, neighborhood: neighborhood, cityId: cityId, stateId: stateId, postalcode: sanitizedPostalCode, image: pictureBlob });
            return res.status(200).json({ message: 'Localização criada com sucesso.' });
        } catch (error) {
            console.error('Erro ao realizar criação de localização.', error);
            return res.status(500).send({ message: 'Erro ao realizar criação de localização.' });
        }
    }



}

module.exports = Users;