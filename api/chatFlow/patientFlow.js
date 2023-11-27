const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const jwt = require('jsonwebtoken');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');

class chatPatientFlow {

    constructor(connection) {
        this.connection = connection;
    }

    async getPatientData(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        try {
            const { patientId } = req.body;

            const getPatientData = await databaseFramework.select("chat_queue", "*", "patient_id = ?", [patientId]);
            if (getPatientData.length <= 0) {
                return res.status(404).json({ message: 'Paciente inexistente.' });
            }

            const getPatientUserData = await databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id = ?", [patientId]);
            if (getPatientUserData.length <= 0) {
                return res.status(404).json({ message: 'Usuário inexistente.' });
            }


            const getPatientLocationData = await databaseFramework.select("location", "*", "personid = ?", [getPatientUserData[0].id]);
            const locationData = getPatientLocationData[0];
            const getCity = await databaseFramework.select("city", "*", "id = ?", [locationData.cityId]);
            const getState = await databaseFramework.select("states", "*", "id = ?", [locationData.stateId]);

            const patientData = getPatientUserData.map(patient => ({
                patientId: patient.id,
                patientName: patient.name,
                patientPhoto: `${patient.userphoto}`,
                patientRole: patient.role,
                patientCity: getCity[0].name,
                patientState: getState[0].nome,
                patientStateTag: getState[0].tag
            }));

            return res.status(200).send(patientData);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async callAttendant(req, res) {
        const { userData, attendantId, isScheduled } = req.body;
        const databaseFramework = new dbUtils(this.connection);
        const date = new Date();

        //usuario autenticado
        if (util.isValidUUID(userData)) {
            const getUserData = await databaseFramework.select("users", "*", "uniqueid = ? ", [userData]);

            const verifyIfUserHaveAChatSession = await databaseFramework.select("chat_sessions", "*", "user_id = ? and finished = 0", [getUserData[0].id]);
            const userChatSessionData = verifyIfUserHaveAChatSession[0];

            if (verifyIfUserHaveAChatSession.length >= 1) {
                return res.status(400).send({ message: 'Usuário já está em uma sessão.', chatData: { attendantId: userChatSessionData.attendant_id, chatId: userChatSessionData.chat_queue_id } });
            }

            const verifyIfUserIsOnQueue = await databaseFramework.select("chat_queue", "*", "patient_id = ? and finished = 0", [getUserData[0].id]);
            if (verifyIfUserIsOnQueue.length >= 1) {
                return res.status(409).send({ message: 'Você já está na fila de atendimento. Aguarde até o atendente aceitar.' });
            }
        }

        const verifyIfUserHaveAChatSession = await databaseFramework.select("chat_sessions", "*", "userData = ? and finished = 0", [userData]);
        const userChatSessionData = verifyIfUserHaveAChatSession[0];
        if (verifyIfUserHaveAChatSession.length >= 1) {
            return res.status(400).send({ message: 'Usuário já está em uma sessão.', chatData: { attendantId: userChatSessionData.attendant_id, chatId: userChatSessionData.chat_queue_id } });
        }

        const verifyIfUserNotLoggedIsOnQueue = await databaseFramework.select("chat_queue", "*", "userSessionId = ? and finished = 0", [userData]);
        if (verifyIfUserNotLoggedIsOnQueue.length >= 1) {
            return res.status(409).send({ message: 'Você já está na fila de atendimento. Aguarde até o atendente aceitar.' });
        }

        const getPatientData = await databaseFramework.select("users", "*", "id = ? and usertype = ? or usertype = ?", [attendantId, systemObjects.UserTypes.ATENDENTE.id, systemObjects.UserTypes.PROFISSIONAL.id]);
        if (getPatientData.length <= 0) { return res.status(400).send({ message: 'Este atendente não existe.' }); }

        const verifyIfAttendantIsAvailable = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [attendantId]);

        if (verifyIfAttendantIsAvailable.length <= 0) { return res.status(400).send({ message: 'Este atendente não está na fila de atendimento.' }); }

        const verifyIfDataAreFromAUser = await databaseFramework.select("users", "*", "uniqueid = ?", [userData]);

        if (isScheduled === 1) {
            await databaseFramework.insert("chat_queue", { userSessionId: null, isLogged: 1, patient_id: verifyIfDataAreFromAUser[0].id, attendant_id: attendantId, isScheduled: 1 });
            return res.status(200).send({ message: 'Convite enviado ao atendente. Aguardando resposta.' });
        }

        if (verifyIfDataAreFromAUser.length <= 0) {
            await databaseFramework.insert("chat_queue", { userSessionId: userData, isLogged: 0, patient_id: null, attendant_id: attendantId, date: date });

            return res.status(200).send({ message: 'Convite enviado ao atendente. Aguardando resposta.' });
        }
        await databaseFramework.insert("chat_queue", { userSessionId: null, isLogged: 1, patient_id: verifyIfDataAreFromAUser[0].id, attendant_id: attendantId, date: date });
        return res.status(200).send({ message: 'Convite enviado ao atendente. Aguardando resposta.' });
    }


}
module.exports = chatPatientFlow;