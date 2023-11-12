const socketIO = require('socket.io');
const dbUtils = require('../util/databaseUtils.js');
const utils = require('../util/util.js');
const attendantFlow = require('../chatFlow/attendantFlow.js');

class SocketConnection {
  constructor(server, connection) {
    this.io = socketIO(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.connection = connection;

    this.io.on('connection', (socket) => {
      console.log(`Socket conectado: ${socket.id}`);

      socket.on('sendQuiz', async (quizData) => {

      });

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
            this.io.emit('chatMessages', { error: 'Chat inexistente.' });
            return;
          }
          const chatSessionData = getChatsFromSenderAndReceiver[0];

          //usuário que envia e que recebe estão logados
          if (utils.isInteger(messageSender) && utils.isInteger(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 1, receiverIsLogged: 1, sender_id: messageSender, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
            this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
            return;
          }

          //usuário que recebe não está logado
          if (!utils.isInteger(messageReceiver)) {
            const createMessage = await databaseFramework.insert("chat_messages", { receiverIsLogged: 0, receiverData: messageReceiver, sender_id: messageSender, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
            this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
            return;
          }


          //usuario que envia não está logado
          if (!utils.isInteger(messageSender)) {
            const createMessage = await databaseFramework.insert("chat_messages", { senderIsLogged: 0, senderData: messageSender, receiver_id: messageReceiver, message: messageContent, created_at: now, chat_session_id: chatSessionData.id });
            this.io.emit('chatMessages', { messageId: createMessage, chatId: chatId, sender_id: messageSender, receiver_id: messageReceiver, sessionId: chatSessionData.id, message: messageContent, return: 'Mensagem enviada com sucesso. ' });
            return;
          }

        } catch (error) {
          console.error('Erro no envio de novas mensagens:', error);
        }
      });

      socket.on('finishChat', async (data) => {
        const chatId = data.chatId;

      });

      socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`Socket ${socket.id} joined room ${roomId}`);
      });

      socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
      });

    });

    // Iniciar verificação de fila
    this.checkQueue();
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
              await databaseFramework.update("chat_attendants", { isAvailable: 0 }, `attendant_id = ${chat.attendant_id}`);
              await databaseFramework.insert("chat_sessions", { attendant_id: chat.attendant_id, user_id: null, isLogged: 0, userData: chat.userSessionId, chat_queue_id: chat.id });

              this.io.emit('chatReady', { chatId: chat.id, patientId: chat.userSessionId, attendantId: chat.attendant_id });
            } else {

              await databaseFramework.update("chat_queue", { sessionCreated: 1 }, `patient_id = ${chat.patient_id}`);
              await databaseFramework.update("chat_attendants", { isAvailable: 0 }, `attendant_id = ${chat.attendant_id}`);
              await databaseFramework.insert("chat_sessions", { attendant_id: chat.attendant_id, user_id: chat.patient_id, isLogged: 1, chat_queue_id: chat.id });

              this.io.emit('chatReady', { chatId: chat.id, patientId: chat.patient_id, attendantId: chat.attendant_id });
            }
          }
        });
      } catch (error) {
        console.error('Erro na verificação da fila:', error);
      }
    }, 5000);
  }

  async getPendingChats() {
    const databaseFramework = new dbUtils(this.connection);
    return await databaseFramework.select("chat_queue", "*", "sessionCreated = 0");
  }

  async getAttendant(attendantId) {
    const databaseFramework = new dbUtils(this.connection);
    const attendants = await databaseFramework.select("chat_attendants", "*", `attendant_id = ${attendantId}`);
    return attendants.length > 0 ? attendants[0] : null;
  }
}

module.exports = SocketConnection;