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

    async callAttendant(req, res) {
        const { userData, attendantId } = req.body;
        const databaseFramework = new dbUtils(this.connection);

        //usuario autenticado
        if (util.isValidUUID(userData)) {
            const getUserData = await databaseFramework.select("users", "*", "uniqueid = ?", [userData]);
            const verifyIfUserIsOnQueue = await databaseFramework.select("chat_queue", "*", "patient_id = ?", [getUserData[0].id]);
            if (verifyIfUserIsOnQueue.length >= 1) {
                return res.status(409).send({ message: 'Você já está na fila de atendimento. Aguarde até o atendente aceitar.' });
            }
        }

        const verifyIfUserNotLoggedIsOnQueue = await databaseFramework.select("chat_queue", "*", "userSessionId = ?", [userData]);
        if (verifyIfUserNotLoggedIsOnQueue.length >= 1) {
            return res.status(409).send({ message: 'Você já está na fila de atendimento. Aguarde até o atendente aceitar.' });
        }

        const getAttendantData = await databaseFramework.select("users", "*", "id = ? and usertype = ?", [attendantId, systemObjects.UserTypes.ATENDENTE.id]);
        if (getAttendantData.length <= 0) { return res.status(400).send({ message: 'Este atendente não existe.' }); }

        const verifyIfAttendantIsAvailable = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [attendantId]);
        const attendantData = verifyIfAttendantIsAvailable[0];

        if (verifyIfAttendantIsAvailable.length <= 0) { return res.status(400).send({ message: 'Este atendente não está na fila de atendimento.' }); }
        if (attendantData.isAvailable === 0) { return res.status(400).send({ message: 'Este atendente não está disponível no momento.' }); }

        const verifyIfDataAreFromAUser = await databaseFramework.select("users", "*", "uniqueid = ?", [userData]);

        //usuário nao esta autenticado.
        if (verifyIfDataAreFromAUser.length <= 0) {
            await databaseFramework.insert("chat_queue", { userSessionId: userData, isLogged: 0, patient_id: null, attendant_id: attendantId });

            return res.status(200).send({ message: 'Convite enviado ao atendente. Aguardando resposta.' });
        }
        await databaseFramework.insert("chat_queue", { userSessionId: null, isLogged: 1, patient_id: verifyIfDataAreFromAUser[0].id, attendant_id: attendantId });
        return res.status(200).send({ message: 'Convite enviado ao atendente. Aguardando resposta.' });


    }


}
module.exports = chatPatientFlow;