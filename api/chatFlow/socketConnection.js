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

    }, 5000);
  }

  async checkQueue() {
    const databaseFramework = new dbUtils(this.connection);
    const getAttendantFlow = new attendantFlow(this.connection);
    try {
      const usersInQueue = await databaseFramework.select("chat_queue", "*", "attendant_id IS NULL");
      const availableAttendants = await databaseFramework.select("chat_attendants", "*", "isAvailable = 1");

      // Supondo que você tenha a lógica para parear usuários e atendentes,
      // vamos dizer que `matchedPairs` é um array de objetos com `userId` e `attendantId`
      const matchedPairs = []; // Sua lógica para parear usuários e atendentes

      for (const pair of matchedPairs) {
        // Aqui você atualizaria o status na base de dados, etc.
        // ...

        // E então emitiria um evento para o atendente e o usuário para iniciar o chat.
        // Você precisa de algum mecanismo para mapear os IDs de usuários e atendentes para os IDs de socket.
        const userSocketId = this.getUserSocketId(pair.userId);
        const attendantSocketId = this.getAttendantSocketId(pair.attendantId);

        this.io.to(userSocketId).emit('queue_update', { message: 'Seu atendente está pronto para atendê-lo.' });
        this.io.to(attendantSocketId).emit('queue_update', { message: 'Você tem um novo usuário para atender.' });
      }

    } catch (error) {
      console.error("Erro ao verificar a fila: ", error);
    }
  }

}

module.exports = SocketConnection;
