const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const jwt = require('jsonwebtoken');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');

class chatAttendantFlow {

    constructor(connection) {
        this.connection = connection;
    }

    async turnAttendantOffline(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { email } = req.body;

        if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const userData = await databaseFramework.select("users", "*", "email = ? and usertype = ?", [email, systemObjects.UserTypes.ATENDENTE.id]);
        if (userData.length === 0) { return res.status(401).send({ message: 'O usuário informado nao existe ou nao é do tipo atendente.' }); }

        const userId = userData[0].id;
        const isAttendantOnline = await databaseFramework.select("chat_attendants", "*", "isAvailable = 1 and attendant_id = ?", [userId]);

        if (isAttendantOnline.length === 1) {

            try {
                await databaseFramework.update("chat_attendants", { isAvailable: 0 }, `attendant_id = ${userId}`);
                return res.status(200).json({ message: 'Você agora está offline.' });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }

        return res.status(409).json({ message: 'Este usuário já está offline.' });

    }

    async turnAttendantOnline(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { email, category } = req.body;

        if (!util.isInteger(category)) { return res.status(409).json({ message: 'Informe uma categoria válida.' }); }
        if (!util.isEmail(email)) { return res.status(409).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const categoryIds = Object.values(systemObjects.ChatCategories).map(category => category.id);
        if (!categoryIds.includes(parseInt(category))) {
            return res.status(409).json({ message: 'Categoria inválida.' });
        }

        const userData = await databaseFramework.select("users", "*", "email = ? and usertype = ?", [email, systemObjects.UserTypes.ATENDENTE.id]);

        if (userData.length === 0) { return res.status(401).send({ message: 'O usuário informado nao existe ou nao é do tipo atendente.' }); }

        const userId = userData[0].id;
        const isAttendantAlreadyOnline = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [userId]);

        if (isAttendantAlreadyOnline.length <= 0) {
            try {
                if (category === 4) {
                    await databaseFramework.insert("chat_attendants", { attendant_id: userId, category_id: category, isAvailable: 1, isAll: 1 });
                    return res.status(200).json({ message: 'Agora você está online na categoria: ' + systemObjects.getCategoryNameById(category) + "." });
                }
                await databaseFramework.insert("chat_attendants", { attendant_id: userId, category_id: category, isAvailable: 1, isAll: 0 });
                return res.status(200).json({ message: 'Você agora está online e receberá novos chamados.' });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }
        const attendantStatusData = isAttendantAlreadyOnline[0];
        if (attendantStatusData.category_id != category || attendantStatusData.isAvailable === 0) {
            try {
                if (category === 4) {
                    await databaseFramework.update("chat_attendants", { isAvailable: 1, category_id: category, isAll: 1 }, `attendant_id = ${userId}`);
                    return res.status(200).json({ message: 'Agora você está online na categoria: ' + systemObjects.getCategoryNameById(category) + "." });
                }
                await databaseFramework.update("chat_attendants", { isAvailable: 1, category_id: category, isAll: 0 }, `attendant_id = ${userId}`);
                return res.status(200).json({ message: 'Agora você está online na categoria: ' + systemObjects.getCategoryNameById(category) + "." });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }
        return res.status(400).json({ message: 'Você já está on-line na categoria selecionada.' });

    }

    async getAllAttendantsFromDB(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        try {
            const getChatAttendants = await databaseFramework.select("chat_attendants", "*");
            if (getChatAttendants.length <= 0) { return res.status(404).json({ message: 'Não há atendentes disponíveis.' }); }

            const attendantIds = getChatAttendants.map(attendant => attendant.attendant_id);
            // Busque os nomes dos atendentes na tabela 'users'
            const getAttendantData = await databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id IN (?)", [attendantIds]);

            const attendantNameData = {};
            getAttendantData.forEach(attendant => {
                attendantNameData[attendant.id] = attendant.name;
            });

            const attendantRoleData = {};
            getAttendantData.forEach(attendant => {
                attendantRoleData[attendant.id] = attendant.role;
            });

            const attendantPhotoData = {};
            getAttendantData.forEach(attendant => {
                attendantPhotoData[attendant.id] = `${attendant.userphoto}`;
            });

            const attendantFinalData = getChatAttendants.map(attendant => ({
                ...attendant,
                attendantName: attendantNameData[attendant.attendant_id],
                attendantPhoto: attendantPhotoData[attendant.attendant_id],
                attendantRole: attendantRoleData[attendant.attendant_id]
            }));

            return res.status(200).send(attendantFinalData);
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }
    }

    // async getAllAttendantsFromDB(req, res) {
    //     const databaseFramework = new dbUtils(this.connection);
    //     try {
    //         const page = parseInt(req.query.page) || 1;
    //         const pageSize = parseInt(req.query.pageSize) || 10;
    //         const offset = (page - 1) * pageSize;

    //         const getChatAttendants = await databaseFramework.selectWithLimit("chat_attendants", "*", undefined, [], pageSize, offset);

    //         if (getChatAttendants.length <= 0) {
    //             return res.status(404).json({ message: 'Não há atendentes disponíveis.' });
    //         }

    //         const attendantIds = getChatAttendants.map(attendant => attendant.attendant_id);
    //         // Busque os nomes dos atendentes na tabela 'users'
    //         const getAttendantData = await databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id IN (?)", [attendantIds]);

    //         const attendantNameData = {};
    //         getAttendantData.forEach(attendant => {
    //             attendantNameData[attendant.id] = attendant.name;
    //         });

    //         const attendantRoleData = {};
    //         getAttendantData.forEach(attendant => {
    //             attendantRoleData[attendant.id] = attendant.role;
    //         });

    //         const attendantPhotoData = {};
    //         getAttendantData.forEach(attendant => {
    //             attendantPhotoData[attendant.id] = `${attendant.userphoto}`;
    //         });

    //         const attendantFinalData = getChatAttendants.map(attendant => ({
    //             ...attendant,
    //             attendantName: attendantNameData[attendant.attendant_id],
    //             attendantPhoto: attendantPhotoData[attendant.attendant_id],
    //             attendantRole: attendantRoleData[attendant.attendant_id]
    //         }));


    //         return res.status(200).send({
    //             data: attendantFinalData,
    //             pagination: {
    //                 page: page,
    //                 pageSize: pageSize,
    //                 total: getChatAttendants.length
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).send({ message: error.message });
    //     }
    // }

    async listChatQueue(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId } = req.body;
        const getAttendantQueue = await databaseFramework.select("chat_queue", "*", "attendant_id = ? and attendantHasAccepted = 0", [attendantId]);

        if (getAttendantQueue.length <= 0) {
            return res.status(404).send({ message: 'Este atendente não possui chats pendentes.' });
        }

        const authenticatedUsers = getAttendantQueue.filter(user => user.isLogged === 1).map(user => user.patient_id);
        const unauthenticatedUsers = getAttendantQueue.filter(user => user.isLogged === 0).map(user => user.userSessionId);

        let users = [];

        if (authenticatedUsers.length > 0) {
            const getUserData = await databaseFramework.select("users", "id, userphoto", "id IN (?)", [authenticatedUsers]);
            users = users.concat(getUserData.map(user => {
                return { userId: user.id, userphoto: `${user.userphoto}` };
            }));
        }

        unauthenticatedUsers.forEach(userId => {
            users.push({ userId: userId, userphoto: null });
        });

        return res.status(200).send(users);
    }

    async acceptChat(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, patientId } = req.body;

        try {
            //fluxo de usuário deslogado
            if (typeof patientId === "string") {
                const getChatQueue = await databaseFramework.select("chat_queue", "*", `userSessionId = "${patientId}" and attendant_id = ?`, [attendantId]);

                if (getChatQueue.length <= 0) { return res.status(404).send({ message: 'O usuário informado não está na fila do atendente informado.' }); }
                if (getChatQueue[0].sessionCreated === 1) { return res.status(409).send({ message: 'A sessão de chat já foi iniciada.' }); }

                await databaseFramework.update("chat_queue", { position: 1, attendantHasAccepted: 1 }, `userSessionId = "${patientId}" and attendant_id = ${attendantId}`);

                return res.status(200).send({ message: 'Chat aceito, iniciando sessão.' });
            }
            const getPatientData = await databaseFramework.select("users", "*", "id = ?", [patientId]);
            if (getPatientData.length <= 0) { return res.status(404).send({ message: 'Este usuário não existe.' }); }

            const getChatQueue = await databaseFramework.select("chat_queue", "*", "patient_id = ? and attendant_id = ?", [patientId, attendantId]);
            if (getChatQueue.length <= 0) { return res.status(404).send({ message: 'O usuário informado não está na fila do atendente informado.' }); }
            if (getChatQueue[0].sessionCreated === 1) { return res.status(409).send({ message: 'A sessão de chat já foi iniciada.' }); }

            await databaseFramework.update("chat_queue", { position: 1, attendantHasAccepted: 1 }, `patient_id = ${patientId} and attendant_id = ${attendantId}`);

            return res.status(200).send({ message: 'Chat aceito, iniciando sessão.' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async getAttendantData(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        try {
            const { attendantId } = req.body;

            const getAttendantData = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [attendantId]);
            if (getAttendantData.length <= 0) {
                return res.status(404).json({ message: 'Atendente inexistente.' });
            }

            const getAttendantUserData = await databaseFramework.select("users", ["id", "name", "userphoto", "role"], "id = ?", [attendantId]);
            if (getAttendantUserData.length <= 0) {
                return res.status(404).json({ message: 'Usuário inexistente.' });
            }


            const getAttendantLocationData = await databaseFramework.select("location", "*", "personid = ?", [getAttendantUserData[0].id]);
            const locationData = getAttendantLocationData[0];
            const getCity = await databaseFramework.select("city", "*", "id = ?", [locationData.cityId]);
            const getState = await databaseFramework.select("states", "*", "id = ?", [locationData.stateId]);

            const attendantData = getAttendantUserData.map(attendant => ({
                attendantId: attendant.id,
                attendantName: attendant.name,
                attendantPhoto: `${attendant.userphoto}`,
                attendantRole: attendant.role,
                attendantCity: getCity[0].name,
                attendantState: getState[0].nome,
                attendantStateTag: getState[0].tag
            }));

            return res.status(200).send(attendantData);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async getAttendantsByCategoryFromDB(req, res) {
        const { categoryId } = req.body;

        const categoryIds = Object.values(systemObjects.ChatCategories).map(category => category.id);
        if (!categoryIds.includes(parseInt(categoryId))) {
            return res.status(409).json({ message: 'Categoria inválida.' });
        }
        const databaseFramework = new dbUtils(this.connection);
        try {
            const getChatAttendants = await databaseFramework.select("chat_attendants", "*", "category_id = ?", [categoryId]);
            if (getChatAttendants.length <= 0) { return res.status(404).json({ message: 'Não há atendentes disponíveis.' }); }
            return res.status(200).send(getChatAttendants);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async getAttendantsByNameFromDB(req, res) {
        const { attendantName } = req.body;
        const databaseFramework = new dbUtils(this.connection);
        try {

            const getAttendantName = await databaseFramework.select("users", "*", "name = ?"[attendantName]);
            if (getAttendantName.length <= 0) { return res.status(404).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message }); }

            const attendantId = getAttendantName[0].name;
            const getChatAttendants = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [attendantId]);

            return res.status(200).send(getChatAttendants);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

}
module.exports = chatAttendantFlow;