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

  async verifyIfAttendantIsAvailable(req, res) {
    const databaseFramework = new dbUtils(this.connection);
    const { attendantId } = req.body;
    try {
      const getAttendantData = await databaseFramework.select("chat_attendants", "*", "attendant_id = ?", [attendantId]);
      if (getAttendantData.length <= 0) { return res.status(404).send({ message: 'Este atendente não existe ou não está disponível.' }); }

      const attendantData = getAttendantData[0];
      if (attendantData.isAvailable == 1) { return res.status(200).send(true); } else { return res.status(400).send(false); }

    } catch (error) {
      const { v4: uuidv4 } = require('uuid');
      const uniqueid = uuidv4();
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'ERRO: verifyIfAttendantIsAvailable: ' + JSON.stringify(error),
        status: 500
      }, this.connection);
      return res.status(500).send({ message: 'Erro ao buscar detalhes do atendente.', error });
    }
  }

  async getQuizFromConversation(req, res) {
    const { chatId } = req.body;
    const databaseFramework = new dbUtils(this.connection);
    try {
      const getQuizFromChat = await databaseFramework.select("quiz_answers", "*", "chat_id = ?", [chatId]);
      if (getQuizFromChat.length <= 0) {
        return res.status(404).send({ message: 'Chat não contém quiz enviado/recebido.' });
      }
      const quizData = getQuizFromChat[0];
      if (quizData.patientIsLogged === 0) {
        return res.status(200).send({ patientId: quizData.userData, attendantId: quizData.attendant_id, chatId: quizData.chat_id, quizId: quiz_id });
      } else {
        return res.status(200).send({ patientId: quizData.patient_id, attendantId: quizData.attendant_id, chatId: quizData.chat_id, quizId: quiz_id });
      }
    } catch (error) {
      const { v4: uuidv4 } = require('uuid');
      const uniqueid = uuidv4();
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'ERRO: getQuizFromConversation: ' + JSON.stringify(error),
        status: 500
      }, this.connection);
      return res.status(500).send({ message: 'Erro ao buscar detalhes do quiz. erro: ' + error.message });
    }
  }

  async getAllMessagesFromConversation(req, res) {
    const { chatId } = req.body;
    const databaseFramework = new dbUtils(this.connection);
    try {
      const getChatId = await databaseFramework.select("chat_sessions", "*", "chat_queue_id = ?", [chatId]);

      if (!getChatId || getChatId.length === 0) {
        return res.status(404).send({ message: 'Chat não encontrado.' });
      }
      const chat_queue = getChatId[0].chat_queue_id;
      const newChatId = getChatId[0].id;
      const getAllMessages = await databaseFramework.select(
        "chat_messages",
        "*",
        "chat_session_id = ?",
        [newChatId]
      );

      // Verifica se há mensagens no chat
      if (!getAllMessages || getAllMessages.length === 0) {
        return res.status(404).send({ message: 'Chat não encontrado.' });
      }


      // Formata as mensagens para a estrutura de objeto desejada
      const formattedMessages = getAllMessages.map(msg => {
        if (msg.senderIsLogged === 0) {
          return {
            messageId: msg.id,
            chatId: chat_queue,
            sender_id: msg.senderData,
            receiver_id: msg.receiver_id,
            sessionId: msg.session_id,
            message: msg.message
          };
        }
        if (msg.receiverIsLogged === 0) {
          return {
            messageId: msg.id,
            chatId: chat_queue,
            sender_id: msg.sender_id,
            receiver_id: msg.receiverData,
            sessionId: msg.session_id,
            message: msg.message
          };
        }
        return {
          messageId: msg.id,
          chatId: chat_queue,
          sender_id: msg.sender_id,
          receiver_id: msg.receiver_id,
          sessionId: msg.session_id,
          message: msg.message
        };
      });

      // Retorna as mensagens com status 200
      return res.status(200).send(formattedMessages);

    } catch (error) {
      const { v4: uuidv4 } = require('uuid');
      const uniqueid = uuidv4();
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'ERRO: getAllMessagesFromConversation: ' + JSON.stringify(error),
        status: 500
      }, this.connection);
      return res.status(500).send({ message: 'Erro ao buscar detalhes do chat.', error });
    }
  }

  async getAllCategoriesWithAttendantsAvailable(req, res) {
    const databaseFramework = new dbUtils(this.connection);
    try {
      let sql = `
      SELECT 
  c.id,
  c.name,
  c.imageURL,
  COUNT(DISTINCT CASE WHEN a.isAll = 1 THEN a.id ELSE NULL END) + 
  COUNT(DISTINCT CASE WHEN a.isAll = 0 AND a.category_id = c.id THEN a.id ELSE NULL END) AS attendantsAvailable
FROM 
  chat_categories c
LEFT JOIN 
  chat_attendants a ON a.isAvailable = 1 AND (a.category_id = c.id OR a.isAll = 1)
WHERE 
  c.id != 4
GROUP BY 
  c.id, c.name, c.imageURL

UNION ALL

SELECT 
  4 as id, 
  'Todos' as name, 
  (SELECT imageURL FROM chat_categories WHERE id = 4) as imageURL, 
  (SELECT COUNT(*) FROM chat_attendants WHERE isAvailable = 1) as attendantsAvailable
FROM 
  dual
WHERE 
  EXISTS (SELECT 1 FROM chat_categories WHERE id = 4);
    `;

      const categoriesWithAttendants = await databaseFramework.rawQuery(sql);

      return res.status(200).send(categoriesWithAttendants);

    } catch (error) {
      const { v4: uuidv4 } = require('uuid');
      const uniqueid = uuidv4();
      util.logToDatabase({
        uniqueid: uniqueid,
        ip: req.ip,
        method: 'GET',
        message: 'ERRO: getAllCategoriesWithAttendants: ' + JSON.stringify(error),
        status: 500
      }, this.connection);
      return res.status(500).send({ message: 'Erro ao buscar detalhes das categorias.', error });
    }

  }
}
module.exports = System;