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
        const currentDate = new Date();

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
                    await databaseFramework.insert("chat_attendants", { attendant_id: userId, category_id: category, isAvailable: 1, isAll: 1, date: currentDate });
                    return res.status(200).json({ message: 'Agora você está online na categoria: ' + systemObjects.getCategoryNameById(category) + "." });
                }
                await databaseFramework.insert("chat_attendants", { attendant_id: userId, category_id: category, isAvailable: 1, isAll: 0, date: currentDate });
                return res.status(200).json({ message: 'Você agora está online e receberá novos chamados.' });
            } catch (error) {
                return res.status(500).json({ message: 'Ocorreu um erro interno. Acione o suporte.' });
            }
        }
        const attendantStatusData = isAttendantAlreadyOnline[0];
        if (attendantStatusData.category_id != category || attendantStatusData.isAvailable === 0) {
            try {
                if (category === 4) {
                    await databaseFramework.update("chat_attendants", { isAvailable: 1, category_id: category, isAll: 1, date: currentDate }, `attendant_id = ${userId}`);
                    return res.status(200).json({ message: 'Agora você está online na categoria: ' + systemObjects.getCategoryNameById(category) + "." });
                }
                await databaseFramework.update("chat_attendants", { isAvailable: 1, category_id: category, isAll: 0, date: currentDate }, `attendant_id = ${userId}`);
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

    async getAllAttendantsFromDBWithPagination(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        try {
            const page = parseInt(req.query.page) || 1;
            const pageSize = parseInt(req.query.pageSize) || 10;
            const offset = (page - 1) * pageSize;
            const category = parseInt(req.query.category) || 4;

            let whereClause = "category_id = ?";

            if (category === 4) {
                whereClause = "1";
            }

            const getChatAttendants = await databaseFramework.selectWithLimit("chat_attendants", "*", whereClause, [category], pageSize, offset);

            if (getChatAttendants.length <= 0) {
                return res.status(404).json({ message: 'Não há atendentes disponíveis.' });
            }

            const countQuery = await databaseFramework.select("chat_attendants", "COUNT(*) as total", whereClause, [category]);
            const totalAttendants = countQuery[0].total;

            const attendantIds = getChatAttendants.map(attendant => attendant.attendant_id);
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

            // Calcular o total de páginas disponíveis
            const totalPages = Math.ceil(totalAttendants / pageSize);

            return res.status(200).send({
                data: attendantFinalData,
                pagination: {
                    page: page,
                    pageSize: pageSize,
                    total: totalAttendants,
                    totalPages: totalPages
                }
            });
        } catch (error) {
            return res.status(500).send({ message: error.message });
        }
    }


    async listChatQueue(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId } = req.body;
        const getAttendantQueue = await databaseFramework.select("chat_queue", "*", "attendant_id = ? and attendantHasAccepted = 0 and finished = 0 and isScheduled = 0", [attendantId]);

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

    async listChatQueueScheduled(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId } = req.body;
        const getAttendantQueue = await databaseFramework.select("chat_queue", "*", "attendant_id = ? and attendantHasAccepted = 0 and isScheduled = 1 and finished = 0", [attendantId]);
        if (getAttendantQueue.length <= 0) {
            return res.status(404).send({ message: 'Este atendente não possui chats pendentes.' });
        }
        const attendantQueueData = getAttendantQueue.map(queue => queue.patient_id);

        const getScheduleData = await databaseFramework.select("appointments", "*", "professional_id = ? and patient_id in (?) and isFinished = 0", [attendantId, attendantQueueData]);
        if (getScheduleData.length <= 0) { return res.status(404).send({ message: 'Este atendente não possui chats agendados pendentes.' }); }


        const authenticatedUsers = getAttendantQueue.filter(user => user.isLogged === 1).map(user => user.patient_id);

        let users = [];

        if (authenticatedUsers.length > 0) {
            const getUserData = await databaseFramework.select("users", "id, userphoto", "id IN (?)", [authenticatedUsers]);
            users = users.concat(getUserData.map(user => {
                return { userId: user.id, userphoto: `${user.userphoto}` };
            }));
        }


        return res.status(200).send(users);
    }

    async acceptChat(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, patientId } = req.body;

        try {
            //fluxo de usuário deslogado
            if (typeof patientId === "string") {
                const getChatQueue = await databaseFramework.select("chat_queue", "*", `userSessionId = "${patientId}" and attendant_id = ? and finished = 0 and sessionCreated = 0`, [attendantId]);

                if (getChatQueue.length <= 0) { return res.status(404).send({ message: 'O usuário informado não está na fila do atendente informado.' }); }
                if (getChatQueue[0].sessionCreated === 1) { return res.status(409).send({ message: 'A sessão de chat já foi iniciada.', chatId: getChatQueue[0].id }); }

                await databaseFramework.update("chat_queue", { position: 1, attendantHasAccepted: 1 }, `userSessionId = "${patientId}" and attendant_id = ${attendantId}`);

                return res.status(200).send({ message: 'Chat aceito, iniciando sessão.' });
            }
            const getPatientData = await databaseFramework.select("users", "*", "id = ?", [patientId]);
            if (getPatientData.length <= 0) { return res.status(404).send({ message: 'Este usuário não existe.' }); }

            const getChatQueue = await databaseFramework.select("chat_queue", "*", "patient_id = ? and attendant_id = ? and finished = 0 and sessionCreated = 0", [patientId, attendantId]);
            if (getChatQueue.length <= 0) { return res.status(404).send({ message: 'O usuário informado não está na fila do atendente informado.' }); }
            if (getChatQueue[0].sessionCreated === 1) { return res.status(409).send({ message: 'A sessão de chat já foi iniciada.', chatId: getChatQueue[0].id }); }

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
            let getChatAttendants;
            if (categoryId === 4) {
                getChatAttendants = await databaseFramework.select("chat_attendants", "*", "isAvailable = 1");
            } else {
                getChatAttendants = await databaseFramework.select("chat_attendants", "*", "category_id = ? and isAvailable = 1 OR isAll = 1", [categoryId]);
            }

            if (getChatAttendants.length <= 0) { return res.status(404).json({ message: 'Não há atendentes disponíveis.' }); }
            const attendantIds = getChatAttendants.map(attendant => attendant.attendant_id);

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

    async attendantAddLocations(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, locationId } = req.body;

        try {
            
            const getLocationById = await databaseFramework.select("appointments_location", "*", "id =?", [locationId]);
            if (getLocationById.length <= 0) { return res.status(404).json({ message: 'O endereço informado não existe.' }); }

            const getAttendantData = await databaseFramework.select("users", "*", "id =? and usertype >= 2", [attendantId]);
            if (getAttendantData.length <= 0) { return res.status(404).json({ message: 'Atendente inexistente.' }); }

            const verifyIfLocationHasAlreadyOnAttendantList = await databaseFramework.select("attendant_schedule_locations", "*", "attendant_id =? and location_id =?", [attendantId, locationId]);
            if (verifyIfLocationHasAlreadyOnAttendantList.length > 0) { return res.status(409).json({ message: 'Atendente já possui esse endereço na lista de endereços de atendimento.' }); }

            await databaseFramework.insert("attendant_schedule_locations", { location_id: locationId, attendant_id: attendantId });
            return res.status(200).json({ message: 'Endereço adicionado com sucesso.' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async deleteAttendantLocation(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, locationId } = req.body;
        try {
            const getLocationById = await databaseFramework.select("appointments_location", "*", "id =?", [locationId]);
            if (getLocationById.length <= 0) { return res.status(404).json({ message: 'O endereço informado não existe.' }); }

            const getAttendantData = await databaseFramework.select("users", "*", "id =? and usertype >= 2", [attendantId]);
            if (getAttendantData.length <= 0) { return res.status(404).json({ message: 'Atendente inexistente.' }); }

            const verifyIfLocationHasAlreadyOnAttendantList = await databaseFramework.select("attendant_schedule_locations", "*", "attendant_id =? and location_id =?", [attendantId, locationId]);
            if (verifyIfLocationHasAlreadyOnAttendantList.length <= 0) { return res.status(409).json({ message: 'Atendente não possui esse endereço na lista de endereços de atendimento.' }); }

            await databaseFramework.delete("attendant_schedule_locations", `attendant_id = ${attendantId} and location_id = ${locationId}`);
            return res.status(200).json({ message: 'Endereço removido com sucesso.' });

        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async getAttendantLocations(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId } = req.body;

        try {
            
            const getAttendantLocationByAttendantId = await databaseFramework.select("attendant_schedule_locations", "*", "attendant_id =?", [attendantId]);
            if (getAttendantLocationByAttendantId.length <= 0) { return res.status(404).json({ message: 'Atendente não possui endereços de atendimento.' }); }
            
            const locationIds = getAttendantLocationByAttendantId.map(location => location.location_id);
            const getLocationById = await databaseFramework.select("appointments_location", "*", "id IN (?)", [locationIds]);
            if (getLocationById.length <= 0) { return res.status(404).json({ message: 'O endereço informado não existe.' }); }
            if (getLocationById) {
                const locationFinalData = await Promise.all(getLocationById.map( async location => ({
                    locationId: location.id,
                    locationName: location.name, 
                    locationAddress: location.address, 
                    locationComplement: location.complement, 
                    locationNeighborhood: location.neighborhood, 
                    locationNumber: location.number, 
                    locationPostalCode: location.postalCode, 
                    locationImage: `${location.image}`, 
                    locationCityName: await util.getCityNameById(location.cityId, this.connection),  
                    locationStateName: await util.getStateNameById(location.stateId, this.connection)
                })));
                return res.status(200).send(locationFinalData);
            }
            
        
    
            
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }
    async insertAvailability(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, date, hours } = req.body;
    
        const dateParts = date.split("/");
        const year = parseInt(dateParts[2], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[0], 10);
    
        const convertedDate = new Date(year, month, day);
        try {
            // Obtenha todos os horários existentes para a data especificada e o atendente
            const existingHours = await databaseFramework.select(
                "attendant_schedule_availability",
                "time",
                "attendant_id = ? AND date = ? AND isInPerson = 0",
                [attendantId, convertedDate]
            );
    
            const existingTimeSet = new Set(existingHours.map((row) => row.time));
    
            // Determine os horários a serem excluídos
            const hoursToDelete = [...existingTimeSet]
                .filter((existingTime) => !hours.includes(existingTime));
    
            // Exclua os horários que não estão na matriz "hours"
            if (hoursToDelete.length > 0) {
                const placeholders = hoursToDelete.map(() => "?").join(", ");
                const deleteQuery = `
                    DELETE FROM attendant_schedule_availability
                    WHERE attendant_id = ?
                    AND date = ?
                    AND time IN (${placeholders})
                    AND isInPerson = 0
                `;
    
                const deleteParams = [attendantId, convertedDate, ...hoursToDelete];
    
                await databaseFramework.rawQuery(deleteQuery, deleteParams);
            }
    
            // Filtrar apenas os horários que não existem na tabela
            const newHours = hours.filter((time) => !existingTimeSet.has(time));
    
            if (newHours.length > 0) {
                const insertData = newHours.map((time) => ({
                    attendant_id: attendantId,
                    date: convertedDate,
                    time: time,
                }));
    
                await databaseFramework.insertMultiple("attendant_schedule_availability", insertData);
            }
    
            return res.status(200).json({ message: 'Horário(s) adicionado(s) com sucesso.' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async insertAvailabilityInPerson(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, date, hours, locationId } = req.body;
    
        const dateParts = date.split("/");
        const year = parseInt(dateParts[2], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[0], 10);
        const convertedDate = new Date(year, month, day);
    
        try {
            const verifyIfLocationExists = await databaseFramework.select("appointments_location", "*", "id = ?", [locationId]);
            if (verifyIfLocationExists.length <= 0) { return res.status(404).json({ message: 'O endereço informado não existe.' }); }
    
            const verifyIfAttendantHasThatLocation = await databaseFramework.select("attendant_schedule_locations", "*", "attendant_id = ? AND location_id = ?", [attendantId, locationId]);
            if (verifyIfAttendantHasThatLocation.length <= 0) { return res.status(404).json({ message: 'Atendente não possui esse endereço na lista de locais de atendimento.' }); }
    
            const existingHours = await databaseFramework.select(
                "attendant_schedule_availability",
                "time",
                "attendant_id = ? AND date = ? AND isInPerson = 1 AND schedule_location_id = ?",
                [attendantId, convertedDate, locationId]
            );
    
            const existingTimeSet = new Set(existingHours.map((row) => row.time));
    
            // Filtrar apenas os horários que não existem na tabela
            const newHours = hours.filter((time) => !existingTimeSet.has(time));
    
            if (newHours.length > 0) {
                const insertData = newHours.map((time) => ({
                    attendant_id: attendantId,
                    date: convertedDate,
                    time: time,
                    schedule_location_id: locationId,
                    isInPerson: 1
                }));
    
                await databaseFramework.insertMultiple("attendant_schedule_availability", insertData);
            }
    
            // Exclua os horários que não estão na matriz "hours"
            const hoursToDelete = [...existingTimeSet]
                .filter((existingTime) => !hours.includes(existingTime));
    
            if (hoursToDelete.length > 0) {
                const placeholders = hoursToDelete.map(() => "?").join(", ");
                const deleteQuery = `
                    DELETE FROM attendant_schedule_availability
                    WHERE attendant_id = ?
                    AND date = ?
                    AND isInPerson = 1
                    AND schedule_location_id = ?
                    AND time IN (${placeholders})
                `;
    
                const deleteParams = [attendantId, convertedDate, locationId, ...hoursToDelete];
    
                await databaseFramework.rawQuery(deleteQuery, deleteParams);
            }
    
            return res.status(200).json({ message: 'Horário(s) adicionado(s) com sucesso.' });
    
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    async getAttendantAvailability(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { attendantId, date, isOnline, locationId } = req.body;

        const dateParts = date.split("/");
        const year = parseInt(dateParts[2], 10);
        const month = parseInt(dateParts[1], 10) - 1;
        const day = parseInt(dateParts[0], 10);
    
        const convertedDate = new Date(year, month, day);
        const isInPerson = isOnline ? 0 : 1;
        try {
        
          if (locationId !== null && isInPerson === 1) {
         const getAttendantAvailability = await databaseFramework.select("attendant_schedule_availability", "*", "attendant_id =? AND date =? AND isInPerson = ? AND schedule_location_id = ?", [attendantId, convertedDate, isInPerson, locationId]);
          
         const getAttendantAvailabilityOnline = await databaseFramework.select("attendant_schedule_availability", "*", "attendant_id =? AND date =? AND schedule_location_id != ? OR schedule_location_id IS NULL", [attendantId, convertedDate, locationId]);
         if (getAttendantAvailability.length <= 0 && getAttendantAvailabilityOnline.length <= 0) { return res.status(404).json({ message: 'Atendente não possui horário(s) de atendimento.' }); }
          const attendantHours = getAttendantAvailability.map(time => time.time);
          const attendantHoursOnline = getAttendantAvailabilityOnline.map(time => time.time);
          
          if (attendantHoursOnline.length > 0 && attendantHours.length > 0) {return res.status(200).send([attendantHours,attendantHoursOnline]);}
          if (attendantHours.length > 0) {return res.status(200).send([attendantHours, [] ]);}
          if (attendantHoursOnline.length > 0) {return res.status(200).send([ [], attendantHoursOnline]);}
          return res.status(200).send([]);
          } 


          const getAttendantAvailability = await databaseFramework.select("attendant_schedule_availability", "*", "attendant_id =? AND date =? AND isInPerson = ?", [attendantId, convertedDate, isInPerson]);
          const getAttendantAvailabilityInPerson = await databaseFramework.select("attendant_schedule_availability", "*", "attendant_id =? AND date =? AND isInPerson = 1", [attendantId, convertedDate]);
         if (getAttendantAvailability.length <= 0 && getAttendantAvailabilityInPerson.length <= 0) { return res.status(404).json({ message: 'Atendente não possui horário(s) de atendimento.' }); }
          const attendantHours = getAttendantAvailability.map(time => time.time);
          const attendantHoursInPerson = getAttendantAvailabilityInPerson.map(time => time.time);
          
          if (attendantHoursInPerson.length > 0 && attendantHours.length > 0) {return res.status(200).send([attendantHours, attendantHoursInPerson]);}
          if (attendantHours.length > 0) {return res.status(200).send([attendantHours, []]);}
          if (attendantHoursInPerson.length > 0) {return res.status(200).send([[], attendantHoursInPerson]);}
          return res.status(200).send([]);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }



}
module.exports = chatAttendantFlow;