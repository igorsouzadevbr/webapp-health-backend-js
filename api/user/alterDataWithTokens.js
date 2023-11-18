const { v4: uuidv4 } = require('uuid');
const util = require('../util/util.js');
const systemMessages = require('../system/systemMessages.js');
const systemObjects = require('../system/systemObjects.js');
const dbUtils = require('../util/databaseUtils.js');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const config = require('../../config.json');
const jwt = require('jsonwebtoken');

class AlterDataWithTokens {
    constructor(connection) {
        this.connection = connection;
    }
    async sendEmailTokenAlterPassword(to, subject, token, userName) {
        try {
            let htmlTemplate = await fs.readFile('./templates/html/alterpass.html', 'utf8');

            htmlTemplate = htmlTemplate.replace('{token}', token);
            htmlTemplate = htmlTemplate.replace('{user}', userName);

            let transporter = nodemailer.createTransport({
                host: config.mail.host,
                port: config.mail.port,
                secure: config.mail.secure,
                auth: {
                    user: config.mail.user,
                    pass: config.mail.pass
                }
            });

            let info = await transporter.sendMail({
                from: '"Teomi APP" <send@dvelopers.com.br>',
                to,
                subject,
                html: htmlTemplate
            });
            return true;
        } catch (error) {
            console.error('Erro ao enviar o email:', error);
            return false;
        }
    }
    async sendEmailTokenAlterMail(to, subject, token, userName) {
        try {
            let htmlTemplate = await fs.readFile('./templates/html/altermail.html', 'utf8');

            htmlTemplate = htmlTemplate.replace('{token}', token);
            htmlTemplate = htmlTemplate.replace('{user}', userName);

            let transporter = nodemailer.createTransport({
                host: config.mail.host,
                port: config.mail.port,
                secure: config.mail.secure,
                auth: {
                    user: config.mail.user,
                    pass: config.mail.pass
                }
            });

            let info = await transporter.sendMail({
                from: '"Teomi APP" <send@dvelopers.com.br>',
                to,
                subject,
                html: htmlTemplate
            });
            return true;
        } catch (error) {
            console.error('Erro ao enviar o email:', error);
            return false;
        }
    }

    async verifyTokenAndAlterUserEmail(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { token, secretKey } = req.body;

        if (token.length < 7) { return res.status(409).json({ message: 'O token deve possuir no mínimo 7 dígitos, sendo 3 letras e 4 números.' }); }

        const tokenExists = await databaseFramework.select("users_mail_tokens", '*', 'token = ? and isEmail = 1', [token]);

        if (tokenExists.length === 1) {
            const alterMailTo = tokenExists[0].alterMailTo;
            const actualTime = new Date();

            if (actualTime >= tokenExists[0].expiresIn) { return res.status(409).json({ message: systemMessages.ErrorMessages.TOKEN_HAS_EXPIRED.message }); }

            //por mais que tenha validado se é email antes, prefiro validar aqui também...
            if (alterMailTo == null || !util.isEmail(alterMailTo)) { return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

            await databaseFramework.update("users", { email: alterMailTo }, `id = ${tokenExists[0].userid}`);

            const uniqueid = uuidv4();
            util.logToDatabase({
                uniqueid: uniqueid,
                ip: req.ip,
                method: 'PATCH',
                message: 'updateUserMailWithToken: ' + JSON.stringify(tokenExists),
                status: 200
            }, this.connection);
            await databaseFramework.delete("users_mail_tokens", `id = ${tokenExists[0].id}`);

            const userLogged = await databaseFramework.select("users", 'uniqueid', `id = ${tokenExists[0].userid}`)
            const secretKey = req.params.secretKey;
            const getUserLocation = await databaseFramework.select("location", "*", "personid = ?", [userLogged[0].id]);
            const userLocationData = getUserLocation[0];
            const token = jwt.sign({ useremail: alterMailTo, useruniqueid: userLogged[0].uniqueid, userId: userLogged[0].id, userType: userLogged[0].usertype, userPostalCode: userLocationData.postalcode }, secretKey, { expiresIn: '96h' });

            return res.status(200).json({ message: 'E-mail atualizado com sucesso.', newUserToken: token, expiresIn: 3 });
        } else {
            return res.status(409).json({ message: 'O token informado não existe ou não é para alteração de e-mail.' });
        }
    }

    async verifyTokenAndAlterUserPassword(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { token } = req.body;

        if (token.length < 7) { return res.status(409).json({ message: 'O token deve possuir no mínimo 7 dígitos, sendo 3 letras e 4 números.' }); }

        const tokenExists = await databaseFramework.select("users_mail_tokens", '*', 'token = ? and isPassword = 1', [token]);

        if (tokenExists.length === 1) {
            const alterPasswordTo = tokenExists[0].alterPasswordTo;
            const actualTime = new Date();

            if (actualTime >= tokenExists[0].expiresIn) { return res.status(409).json({ message: systemMessages.ErrorMessages.TOKEN_HAS_EXPIRED.message }); }

            await databaseFramework.update("users", { password: alterPasswordTo }, `id = ${tokenExists[0].userid}`);

            const uniqueid = uuidv4();
            util.logToDatabase({
                uniqueid: uniqueid,
                ip: req.ip,
                method: 'PATCH',
                message: 'updateUserPasswordWithToken: ' + JSON.stringify(tokenExists),
                status: 200
            }, this.connection);
            await databaseFramework.delete("users_mail_tokens", `id = ${tokenExists[0].id}`);
            const isUserBlocked = await databaseFramework.select("users_punishments", "*", "userid = ?", [tokenExists[0].id]);
            if (isUserBlocked.length <= 0) {
                return res.status(200).json({ message: 'Senha atualizada com sucesso, utilize-a no próximo login.' });
            }

            await databaseFramework.update("users_punishments", { isblocked: 0, blockeddate: null }, `userid = ${tokenExists[0].id}`);
            await databaseFramework.delete("login_attempts", `userid = ${tokenExists[0].id}`);
            return res.status(200).json({ message: 'Senha atualizada com sucesso, utilize-a no próximo login.' });
        } else {
            return res.status(409).json({ message: 'O token informado não existe ou não é para alteração de senha.' });
        }
    }

    async getTokenToAlterUserPassword(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { email, password } = req.body;

        const newPasswordEncrypted = util.convertToSHA256(password);

        if (email == null || !util.isEmail(email)) { return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const userDetails = await databaseFramework.select("users", '*', `email = ?`, [email]);

        if (userDetails.length === 0) { return res.status(403).json({ message: systemMessages.ErrorMessages.INEXISTENT_USER.message }); }

        const userHasAlreadyWithAPendingToken = await databaseFramework.select('users_mail_tokens', '*', `userid = ?`, [userDetails[0].id]);
        let actualTime = new Date();
        if (userHasAlreadyWithAPendingToken.length >= 1 && userHasAlreadyWithAPendingToken[0].isPassword === 1 && actualTime <= userHasAlreadyWithAPendingToken[0].expiresIn) {
            return res.status(403).json({ message: systemMessages.ErrorMessages.ALREADY_HAS_A_TOKEN_IN_PROGRESS.message });
        }

        if (userDetails.length > 0) {
            const userActualPassword = userDetails[0].password;
            if (newPasswordEncrypted === userActualPassword) { return res.status(409).json({ message: 'A nova senha é igual a senha anterior.' }); }

            const userToken = util.generateToken();
            let expiresIn = new Date();
            expiresIn.setMinutes(expiresIn.getMinutes() + 15);

            if (await this.sendEmailTokenAlterPassword(email, "TEOMI - Aqui está o seu token!", userToken, userDetails[0].name)) {

                if (userHasAlreadyWithAPendingToken.length === 1 && userHasAlreadyWithAPendingToken[0].isPassword === 1) {
                    await databaseFramework.delete(`users_mail_tokens`, `id = ${userHasAlreadyWithAPendingToken[0].id}`);
                }

                await databaseFramework.insert("users_mail_tokens", { userid: userDetails[0].id, isPassword: 1, isEmail: 0, token: userToken, expiresIn: expiresIn, alterPasswordTo: newPasswordEncrypted });
                return res.status(200).json({ message: 'Enviamos um token para o email ' + email + ' para verificação.', expiresIn: expiresIn });
            } else {
                return res.status(500).json({ message: 'Ocorreu um erro ao enviar o e-mail' });
            }

        } else {
            return res.status(409).json({ message: 'Este usuário não existe.' });
        }
    }

    async getTokenToAlterUserEmail(req, res) {
        const databaseFramework = new dbUtils(this.connection);
        const { mailto, email, secretKey } = req.body;

        if (email == null || !util.isEmail(email)) { return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }
        if (mailto == null || !util.isEmail(mailto)) { return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }

        const userData = await databaseFramework.select('users', '*', 'email = ?', [email]);
        if (userData.length === 0) { return res.status(403).json({ message: systemMessages.ErrorMessages.INCORRECT_EMAIL.message }); }
        const userHasAlreadyWithAPendingToken = await databaseFramework.select('users_mail_tokens', '*', 'userid = ?', [userData[0].id]);
        let actualTime = new Date();
        if (userHasAlreadyWithAPendingToken.length >= 1 && userHasAlreadyWithAPendingToken[0].isEmail === 1 && actualTime <= userHasAlreadyWithAPendingToken[0].expiresIn) {
            return res.status(403).json({ message: systemMessages.ErrorMessages.ALREADY_HAS_A_TOKEN_IN_PROGRESS.message });
        }
        const userToken = util.generateToken();
        let expiresIn = new Date();
        expiresIn.setMinutes(expiresIn.getMinutes() + 15);

        if (await this.sendEmailTokenAlterMail(mailto, "TEOMI - Aqui está o seu token!", userToken, userData[0].name)) {
            if (userHasAlreadyWithAPendingToken.length === 1 && userHasAlreadyWithAPendingToken[0].isEmail === 1) {
                await databaseFramework.delete(`users_mail_tokens`, `id = ${userHasAlreadyWithAPendingToken[0].id}`);
            }
            await databaseFramework.insert("users_mail_tokens", { userid: userData[0].id, isPassword: 0, isEmail: 1, token: userToken, expiresIn: expiresIn, alterMailTo: mailto });
            return res.status(200).json({ message: 'E-mail enviado com sucesso para ' + mailto, expiresIn: expiresIn });
        } else {
            return res.status(500).json({ message: 'Ocorreu um erro ao enviar o e-mail' });
        }
    }

}
module.exports = AlterDataWithTokens;