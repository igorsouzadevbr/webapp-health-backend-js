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

              this.io.emit('chatReady', { patientId: chat.userSessionId, attendantId: chat.attendant_id });
            } else {

              await databaseFramework.update("chat_queue", { sessionCreated: 1 }, `patient_id = ${chat.patient_id}`);
              await databaseFramework.update("chat_attendants", { isAvailable: 0 }, `attendant_id = ${chat.attendant_id}`);
              await databaseFramework.insert("chat_sessions", { attendant_id: chat.attendant_id, user_id: chat.patient_id, isLogged: 1, chat_queue_id: chat.id });

              this.io.emit('chatReady', { patientId: chat.patient_id, attendantId: chat.attendant_id });
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