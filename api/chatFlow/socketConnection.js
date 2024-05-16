const socketIO = require('socket.io');
const dbUtils = require('../util/databaseUtils.js');
const utils = require('../util/util.js');
const attendantFlow = require('../chatFlow/attendantFlow.js');
const moment = require('moment-timezone');
class SocketConnection {

  constructor(server, connection) {
    this.io = socketIO(server, {
      rejectUnauthorized: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.connection = connection;

    this.io.on('connection', (socket) => {

      socket.on('attendantSendQuiz', async (quizData) => {
        const attendantId = quizData.attendantId;
        const patientId = quizData.patientId;
        const chatId = quizData.chatId;

        //fluxo user deslogado
        if (!utils.isOnlyNumbers(patientId)) {
          try {
            const databaseFramework = new dbUtils(this.connection);
            const verifyIfPatientAlreadyHasAQuiz = await databaseFramework.select("quiz_answers", "*", "userData = ? and attendant_id = ? and chat_id = ? and answered = 0", [patientId, attendantId, chatId]);
            if (verifyIfPatientAlreadyHasAQuiz.length === 1) {
              this.io.emit('quizError', { message: 'Este paciente já tem um quiz pendente vinculado a ele neste chat.' });
              return;
            }
            const insertQuiz = await databaseFramework.insert("quiz_answers", { patientIsLogged: 0, attendant_id: attendantId, userData: patientId, quiz_id: 1, finalPoints: 0, chat_id: chatId });
            this.io.emit('quizToPatientSession', { patientId: patientId, attendantId: attendantId, quizId: insertQuiz, chatId: chatId, patientIsLogged: 0, message: 'Quiz enviado para o paciente.' });
          } catch (error) {
            console.error('Erro no envio do Quiz:', error);
          }
          return;
        }
        try {
          const databaseFramework = new dbUtils(this.connection);
          const verifyIfPatientAlreadyHasAQuiz = await databaseFramework.select("quiz_answers", "*", "patient_id = ? and attendant_id = ? and chat_id = ? and answered = 0", [patientId, attendantId, chatId]);
          if (verifyIfPatientAlreadyHasAQuiz.length === 1) {
            this.io.emit('quizError', { message: 'Este paciente já tem um quiz vinculado a ele neste chat.' });
            return;
          }
          const insertQuiz = await databaseFramework.insert("quiz_answers", { patientIsLogged: 1, attendant_id: attendantId, patient_id: patientId, quiz_id: 1, finalPoints: 0, chat_id: chatId });
          this.io.emit('quizToPatientSession', { patientId: patientId, attendantId: attendantId, quizId: insertQuiz, chatId: chatId, patientIsLogged: 1, message: 'Quiz enviado para o paciente.' });
        } catch (error) {
          console.error('Erro no envio do Quiz:', error);
        }
      });

      socket.on('quizResult', async (quizData) => {
        const chatId = quizData.chatId;
        const finalPoints = quizData.finalPoints;
        try {
          const databaseFramework = new dbUtils(this.connection);
          await databaseFramework.update("quiz_answers", { finalPoints: finalPoints, answered: 1 }, `chat_id = ${chatId}`);
          const getQuizData = await databaseFramework.select("quiz_answers", "*", "chat_id = ?", [chatId]);
          const quizData = getQuizData[0];
          if (quizData.patientIsLogged === 1) {
            this.io.emit('quizResultCallback', { answered: 1, chatId: chatId, patientId: quizData.patient_id, attendantId: quizData.attendant_id, finalPoints: finalPoints });
          } else {
            this.io.emit('quizResultCallback', { answered: 1, chatId: chatId, patientId: quizData.userData, attendantId: quizData.attendant_id, finalPoints: finalPoints });
          }
        } catch (error) {
          console.error('Erro no envio do Quiz:', error);
        }
      });

      socket.on('chatMessageWithService', async (messageData) => {
        const messageSender = 93;
        const messageReceiver = messageData.messageReceiver;
        const messageContent = messageData.messageContent;
        const chatId = messageData.chatId;
        const now = new Date();

        try {
          const databaseFramework = new dbUtils(this.connection);
          const getChatsFromSenderAndReceiver = await databaseFramework.select("chat_sessions", "*", "chat_queue_id = ?", [chatId]);

          if (getChatsFromSenderAndReceiver.length <= 0) {
            this.io.emit('chatMessages', { message: 'Este chat não existe' });
            return;
          }

          const chatSessionData = getChatsFromSenderAndReceiver[0];

          // //user deslogado manda mensagem pra user logado
          // if (!utils.isOnlyNumbers(messageSender) && utils.isOnlyNumbers(messageReceiver)) {
          //   const createMessage = await databaseFramework.insert("chat_messages",
          //     {
          //       senderIsLogged: 0,
          //       senderData: messageSender,
          //       receiverIsLogged: 1,
          //       receiver_id: messageReceiver,
          //       message: messageContent,
          //       created_at: now,
          //       chat_session_id: chatSessionData.id
          //     }
          //   );
          //   this.io.emit('chatMessages',
          //     {
          //       messageId: createMessage,
          //       chatId: chatId,
          //       sender_id: messageSender,
          //       receiver_id: +messageReceiver,
          //       sessionId: chatSessionData.id,
          //       message: messageContent,
          //       return: 'Mensagem enviada com sucesso. '
          //     }
          //   );
          //   return;
          // }

          //user logado manda mensagem pra user deslogado
          if (utils.isOnlyNumbers(messageSender) && !utils.isOnlyNumbers(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages",
              {
                senderIsLogged: 1,
                sender_id: messageSender,
                receiverIsLogged: 0,
                receiverData: messageReceiver,
                message: messageContent,
                created_at: now,
                chat_session_id: chatSessionData.id
              }
            );
            this.io.emit('chatMessages',
              {
                messageId: createMessage,
                chatId: chatId,
                sender_id: +messageSender,
                receiver_id: messageReceiver,
                sessionId: chatSessionData.id,
                message: messageContent,
                return: 'Mensagem enviada com sucesso. '
              }
            );
            return;
          }

          //user logado manda mensagem pra user logado
          if (utils.isOnlyNumbers(messageSender) && utils.isOnlyNumbers(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages",
              {
                senderIsLogged: 1,
                sender_id: messageSender,
                receiverIsLogged: 1,
                receiver_id: messageReceiver,
                message: messageContent,
                created_at: now,
                chat_session_id: chatSessionData.id
              }
            );
            this.io.emit('chatMessages',
              {
                messageId: createMessage,
                chatId: chatId,
                sender_id: +messageSender,
                receiver_id: +messageReceiver,
                sessionId: chatSessionData.id,
                message: messageContent,
                return: 'Mensagem enviada com sucesso. '
              }
            );
            return;
          }


          // if (!utils.isOnlyNumbers(messageReceiver) && utils.isOnlyNumbers(messageSender)) {
          //   const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, sender_id: messageSender, receiverIsLogged: 0, receiverData: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          //   this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: +messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
          //   return;
          // }

          // if (utils.isOnlyNumbers(messageSender) && utils.isOnlyNumbers(messageReceiver)) {
          //   const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, sender_id: messageSender, receiverIsLogged: 1, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          //   this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: +messageSender, receiver_id: +messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
          //   return;
          // }

          // const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, sender_id: messageSender, receiverIsLogged: 1, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          // this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: +messageSender, receiver_id: +messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem com usuário de serviço enviada com sucesso. ' });

        } catch (error) {
          console.error('Erro no envio de mensagens com o user de serviço:', error);
        }
      }
      );

      socket.on('chatMessage', async (messageData) => {
        const messageSender = messageData.sender_id;
        const messageReceiver = messageData.receiver_id;
        const messageContent = messageData.message;
        const chatId = messageData.chatId;
        const now = new Date();

        try {
          const databaseFramework = new dbUtils(this.connection);
          const getChatsFromSenderAndReceiver = await databaseFramework.select("chat_sessions", "*", "chat_queue_id = ?", [chatId]);

          if (getChatsFromSenderAndReceiver.length <= 0) {
            this.io.emit('chatMessages', { message: 'Este chat não existe' });
            return;
          }

          const chatSessionData = getChatsFromSenderAndReceiver[0];

          //user deslogado manda mensagem pra user logado
          if (!utils.isOnlyNumbers(messageSender) && utils.isOnlyNumbers(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages",
              {
                senderIsLogged: 0,
                senderData: messageSender,
                receiverIsLogged: 1,
                receiver_id: messageReceiver,
                message: messageContent,
                created_at: now,
                chat_session_id: chatSessionData.id
              }
            );
            this.io.emit('chatMessages',
              {
                messageId: createMessage,
                chatId: chatId,
                sender_id: messageSender,
                receiver_id: +messageReceiver,
                sessionId: chatSessionData.id,
                message: messageContent,
                return: 'Mensagem enviada com sucesso. '
              }
            );
            return;
          }

          //user logado manda mensagem pra user deslogado
          if (utils.isOnlyNumbers(messageSender) && !utils.isOnlyNumbers(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages",
              {
                senderIsLogged: 1,
                sender_id: messageSender,
                receiverIsLogged: 0,
                receiverData: messageReceiver,
                message: messageContent,
                created_at: now,
                chat_session_id: chatSessionData.id
              }
            );
            this.io.emit('chatMessages',
              {
                messageId: createMessage,
                chatId: chatId,
                sender_id: +messageSender,
                receiver_id: messageReceiver,
                sessionId: chatSessionData.id,
                message: messageContent,
                return: 'Mensagem enviada com sucesso. '
              }
            );
            return;
          }

          //user logado manda mensagem pra user logado
          if (utils.isOnlyNumbers(messageSender) && utils.isOnlyNumbers(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages",
              {
                senderIsLogged: 1,
                sender_id: messageSender,
                receiverIsLogged: 1,
                receiver_id: messageReceiver,
                message: messageContent,
                created_at: now,
                chat_session_id: chatSessionData.id
              }
            );
            this.io.emit('chatMessages',
              {
                messageId: createMessage,
                chatId: chatId,
                sender_id: +messageSender,
                receiver_id: +messageReceiver,
                sessionId: chatSessionData.id,
                message: messageContent,
                return: 'Mensagem enviada com sucesso. '
              }
            );
            return;
          }

          // if (!utils.isOnlyNumbers(messageReceiver) && utils.isOnlyNumbers(messageSender)) {
          //   const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, sender_id: messageSender, receiverIsLogged: 0, receiverData: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          //   this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: +messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
          //   return;
          // }

          // if (utils.isOnlyNumbers(messageSender) && utils.isOnlyNumbers(messageReceiver)) {
          //   const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, sender_id: messageSender, receiverIsLogged: 1, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          //   this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: +messageSender, receiver_id: +messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
          //   return;
          // }

          // if (utils.isOnlyNumbers(messageSender)) {
          //   const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, sender_id: messageSender, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          //   this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
          //   return;
          // }

          // const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 0, senderData: messageSender, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
          // this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });

        } catch (error) {
          console.error('Erro no envio de mensagens:', error);
        }
      });

      socket.on('finishChat', async (data) => {

        try {
          const chatId = data.chatId;
          const databaseFramework = new dbUtils(this.connection);

          const getChatData = await databaseFramework.select("chat_queue", "*", "id = ?", [chatId]);
          const chatData = getChatData[0];


          await databaseFramework.update("chat_attendants", { isOnChat: 0 }, `attendant_id = ${chatData.attendant_id}`);

          await databaseFramework.update("chat_queue", { finished: 1 }, `id = ${chatId}`);
          await databaseFramework.update("chat_sessions", { finished: 1 }, `chat_queue_id = ${chatId}`);
          if (chatData.isScheduled === 1) {
            await databaseFramework.update("appointments", { isFinished: 1 }, `patient_id = ${chatData.patient_id}`);
            await databaseFramework.update("user_appointments", { isFinished: 1 }, `patient_id = ${chatData.patient_id}`);
          }
          this.io.emit('finishedChat', { chatId: chatId, finished: 1 });
        } catch (error) {
          console.error('Erro no envio de mensagens:', error);
        }

      });

      socket.on('finishService', async (data) => {
        try {
          const chatId = data.chatId;
          const databaseFramework = new dbUtils(this.connection);

          const getChatData = await databaseFramework.select("chat_queue", "*", "id = ?", [chatId]);
          const chatData = getChatData[0];

          await databaseFramework.update("chat_attendants", { isOnChat: 0 }, `attendant_id = ${chatData.attendant_id}`);

          await databaseFramework.update("chat_queue", { finished: 1 }, `id = ${chatId}`);
          await databaseFramework.update("chat_sessions", { finished: 1 }, `chat_queue_id = ${chatId}`);
          if (chatData.isScheduled === 1) {
            await databaseFramework.update("appointments", { isFinished: 1 }, `patient_id = ${chatData.patient_id}`);
            await databaseFramework.update("user_appointments", { isFinished: 1 }, `patient_id = ${chatData.patient_id}`);
          }
          this.io.emit('finishedService', { chatId: chatId, finished: 1 });
        } catch (error) {
          console.error('Erro no envio de mensagens:', error);
        }

      });

    });

    this.checkQueue();
    this.checkAndDeleteQueueItems();
    this.checkChatsWithNoMessages();
    this.checkQttOfAttendantSchedules();
    this.getAttendantQueue();
    this.getCategoriesWithAttendantsAvailable();
  }

  async getCategoriesWithAttendantsAvailable() {
    const databaseFramework = new dbUtils(this.connection);
    try {
      setInterval(async () => {
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
        this.io.emit('categoriesWithAttendantsAvailable', categoriesWithAttendants);
      }, 3000);
    } catch (error) {
      console.error('Erro ao obter a fila de atendentes:', error);
    }
  }

  async getAttendantQueue() {
    try {
      const databaseFramework = new dbUtils(this.connection);
      
      setInterval(async () => {
        const getAllAttendants = await databaseFramework.select(
          "chat_queue",
          "DISTINCT attendant_id",
          "attendantHasAccepted = 0 and finished = 0 and isScheduled = 0"
        );

        const attendantQueue = [];
        
        for (const attendant of getAllAttendants) {
          const attendantId = attendant.attendant_id;
          const getAttendantQueue = await databaseFramework.select(
            "chat_queue",
            "*",
            "attendant_id = ? and attendantHasAccepted = 0 and finished = 0 and isScheduled = 0",
            [attendantId]
          );

          const getAttendantUrgentQueue = await databaseFramework.select(
            "urgent_queue",
            "*",
            "attendantHasAccepted = 0",
            [attendantId]
          );
          
          const combinedQueue = [...getAttendantQueue, ...getAttendantUrgentQueue];
          
          if (combinedQueue.length > 0) {
            const authenticatedUsers = combinedQueue.filter(user => user.isLogged === 1).map(user => user.patient_id || user.user_id);
            const unauthenticatedUsers = combinedQueue.filter(user => user.isLogged === 0).map(user => user.userData || user.userSessionId);
  
            let users = [];
  
            if (authenticatedUsers.length > 0) {
              const getUserData = await databaseFramework.select("users", "id, userphoto", "id IN (?)", [authenticatedUsers]);
              users = users.concat(getUserData.map(user => {
                return { attendantId: attendantId, userId: user.id, userphoto: `${user.userphoto}` };
              }));
            }
  
            unauthenticatedUsers.forEach(userId => {
              users.push( { attendantId: attendantId, userId: userId, userphoto: null });
            });
  
            attendantQueue.push( { attendantId, users } );
            
          }
        }
        this.io.emit('attendantQueue', attendantQueue);
        
      }, 3000);
    } catch (error) {
      console.error('Erro ao obter a fila de atendentes:', error);
    }
  } 

  async checkChatsWithNoMessages() {
    setInterval(async () => {
      try {
        const databaseFramework = new dbUtils(this.connection);
        moment.tz.setDefault('America/Sao_Paulo');
        const currentDate = moment();
        const tenMinutesAgo = currentDate.clone().subtract(20, 'minutes');

        const chatSessions = await databaseFramework.select('chat_sessions', '*', 'finished = 0');
        if (chatSessions.length >= 1) {
          for (const chatSession of chatSessions) {
            const getChatMessages = await databaseFramework.select("chat_messages", "*", "chat_session_id = ? and created_at <= ? ORDER BY ID desc LIMIT 1", [chatSession.id, tenMinutesAgo.format('YYYY-MM-DD HH:mm:ss')]);
            if (getChatMessages.length > 0) {
              await databaseFramework.update("chat_attendants", { isOnChat: 0 }, `attendant_id = ${chatSession.attendant_id}`);
              await databaseFramework.update("chat_sessions", { finished: 1 }, `id = ${chatSession.id}`);
              await databaseFramework.update("chat_queue", { finished: 1 }, `id = ${chatSession.chat_queue_id}`);
              this.io.emit('finishedService', { chatId: chatSession.chat_queue_id, finished: 1 });
            }
          }
        }
      } catch (error) {
        console.error('Erro na verificação e exclusão da fila:', error);
      }
    }, 60000);
  }

  async checkQttOfAttendantSchedules() {
    setInterval(async () => {
    try {
      const databaseFramework = new dbUtils(this.connection);
  
      let sql = `
        SELECT professional_id AS attendantId,
               SUM(CASE WHEN isConfirmed = 1 AND isDeleted = 0 THEN 1 ELSE 0 END) AS confirmedCount,
               SUM(CASE WHEN isConfirmed = 0 AND isDeleted = 0 THEN 1 ELSE 0 END) AS waitingConfirmationCount
        FROM appointments
        WHERE isDeleted = 0
        AND date >= NOW() - INTERVAL 1 MINUTE
        GROUP BY attendantId
      `;
  
      const results = await databaseFramework.rawQuery(sql);
  
      if (results.length > 0) {
        results.forEach(result => {
          const { attendantId, confirmedCount, waitingConfirmationCount } = result;
          this.io.emit('attendantSchedulesQuantity', {
            attendantId,
            confirmedCount,
            waitingConfirmationCount
          });
        });
      }
  
    } catch (error) {
      console.error('Erro na verificação e exclusão da fila:', error);
    }
  }, 5000);
  }

  async checkAndDeleteQueueItems() {
    setInterval(async () => {
      try {
        const databaseFramework = new dbUtils(this.connection);
        moment.tz.setDefault('America/Sao_Paulo');
        const currentDate = moment();
        const fiveMinutesAgo = currentDate.clone().subtract(5, 'minutes');

        const queueItems = await databaseFramework.select(
          'chat_queue',
          '*',
          'finished = 0 AND attendantHasAccepted = 0 AND isScheduled = 0 AND date <= ?',
          [fiveMinutesAgo.format('YYYY-MM-DD HH:mm:ss')]
        );

        for (const item of queueItems) {
          await databaseFramework.delete('chat_queue', `id = ${item.id}`);
          if (item.isLogged === 1) {
            this.io.emit('deletedUserFromQueue', { patientId: item.patient_id, attendantId: item.attendant_id });
          } else {
            this.io.emit('deletedUserFromQueue', { patientId: item.userSessionId, attendantId: item.attendant_id });
          }
        }

      } catch (error) {
        console.error('Erro na verificação e exclusão da fila:', error);
      }
    }, 2 * 60 * 1000);
  }

  async checkQueue() {
    setInterval(async () => {
      try {
        const databaseFramework = new dbUtils(this.connection);
        const chats = await this.getPendingChats();

        chats.forEach(async (chat) => {
          const attendant = await this.getAttendant(chat.attendant_id);

          if (attendant && attendant.isAvailable && chat.attendantHasAccepted) {
            if (chat.isLogged === 0) {
              await databaseFramework.update("chat_queue", { sessionCreated: 1 }, `userSessionId = "${chat.userSessionId}"`);
              await databaseFramework.update("chat_attendants", { isOnChat: 1 }, `attendant_id = ${chat.attendant_id}`);
              await databaseFramework.insert("chat_sessions", { attendant_id: chat.attendant_id, user_id: null, isLogged: 0, userData: chat.userSessionId, chat_queue_id: chat.id });

              this.io.emit('chatReady', { chatId: chat.id, patientId: chat.userSessionId, attendantId: chat.attendant_id });
              this.io.emit('chatReadyAttendant', { chatId: chat.id, patientId: chat.userSessionId, attendantId: chat.attendant_id });
              return;
            } else {

              await databaseFramework.update("chat_queue", { sessionCreated: 1 }, `patient_id = ${chat.patient_id}`);
              await databaseFramework.update("chat_attendants", { isOnChat: 1 }, `attendant_id = ${chat.attendant_id}`);
              await databaseFramework.insert("chat_sessions", { attendant_id: chat.attendant_id, user_id: chat.patient_id, isLogged: 1, chat_queue_id: chat.id });

              this.io.emit('chatReady', { chatId: chat.id, patientId: chat.patient_id, attendantId: chat.attendant_id });
              this.io.emit('chatReadyAttendant', { chatId: chat.id, patientId: chat.patient_id, attendantId: chat.attendant_id });
              return;
            }
          }
        });
      } catch (error) {
        console.error('Erro na verificação da fila:', error);
      }
    }, 4500);
  }

  async getPendingChats() {
    const databaseFramework = new dbUtils(this.connection);
    return await databaseFramework.select("chat_queue", "*", "sessionCreated = 0 and finished = 0");
  }

  async getAttendant(attendantId) {
    const databaseFramework = new dbUtils(this.connection);
    const attendants = await databaseFramework.select("chat_attendants", "*", `attendant_id = ${attendantId} and isOnChat = 0`);
    return attendants.length > 0 ? attendants[0] : null;
  }
}

module.exports = SocketConnection;