const socketIO = require('socket.io');
const dbUtils = require('../util/databaseUtils.js');
const utils = require('../util/util.js');

class SocketConnection {
  constructor(server, connection) {
    this.io = socketIO(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.connection = connection;
    this.users = [];
    this.queue = [];

    this.io.on('connection', (socket) => {
      console.log(`Socket conectado: ${socket.id}`);

      // Lógica para manipular mensagens recebidas do cliente
      socket.on('message', (data) => {
        console.log(`Mensagem recebida: ${data}`);

        // Enviar a mensagem de volta para todos os clientes conectados
        this.io.emit('message', data);
      });

      // Lógica para lidar com desconexões de cliente
      socket.on('disconnect', () => {
        console.log(`Socket desconectado: ${socket.id}`);
      });
    });

    setInterval(() => {
      this.checkQueue();
    }, 5000);
  }

  async getAttendantsFromDB(callback) {
    const databaseFramework = new dbUtils(this.connection);
    try {
      const getChatAttendants = await databaseFramework.select("chat_attendants", "*");
      callback(null, getChatAttendants);
    } catch (error) {
      callback(error, null);
    }
  }

}

module.exports = SocketConnection;
