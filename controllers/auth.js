const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const sendGridTransport = require('nodemailer-sendgrid-transport');
const {validationResult} = require('express-validator');

const User = require('../models/user');

const transporter = nodemailer.createTransport(sendGridTransport({
    auth: {
        api_key: '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'
    }
}));

exports.getLogin = (req, res, next) => {
    const messages = req.flash('error');
    const errorMessage = messages.length > 0 ? messages[0] : null;
    res.render('auth/login', {
        path: '/auth/login',
        pageTitle: 'Login',
        errorMessage: errorMessage,
        oldInput: {email: "", password: ""},
        validationErrors: []
    })
};

exports.postLogin = (req, res, next) => {
    const {email, password} = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('auth/login', {
            path: '/auth/login',
            pageTitle: 'Login',
            errorMessage: errors.array()[0].msg,
            oldInput: {email, password},
            validationErrors: errors.array()
        })
    }

    User.findOne({email})
        .then(user => {
            if (!user) {
                return res.status(422).render('auth/login', {
                    path: '/auth/login',
                    pageTitle: 'Login',
                    errorMessage: 'Invalid email or password',
                    oldInput: {email, password},
                    validationErrors: []
                })
            }
            bcrypt.compare(password, user.password)
                .then(doMatch => {
                    if (doMatch) {
                        req.session.isLoggedIn = true;
                        req.session.user = user;
                        return req.session.save(() => {
                            res.redirect('/');
                        });
                    }

                    return res.status(422).render('auth/login', {
                        path: '/auth/login',
                        pageTitle: 'Login',
                        errorMessage: 'Invalid email or password',
                        oldInput: {email, password},
                        validationErrors: []
                    })
                })
                .catch(err => {
                    const error = new Error(err);
                    error.httpStatusCode = 500;
                    return next(error);
                })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postLogout = (req, res, next) => {
    req.session.destroy(() => {
        res.redirect('/');
    });
};


exports.getSignup = (req, res, next) => {
    const messages = req.flash('error');
    const errorMessage = messages.length > 0 ? messages[0] : null;
    res.render('auth/signup', {
        path: '/signup',
        pageTitle: 'Signup',
        errorMessage: errorMessage,
        oldInput: {email: "", password: "", confirmPassword: ""},
        validationErrors: []
    });
};
exports.postSignup = (req, res, next) => {
    const {email, password, confirmPassword} = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(422).render('auth/signup', {
            path: '/signup',
            pageTitle: 'Signup',
            errorMessage: errors.array()[0].msg,
            oldInput: {email, password, confirmPassword},
            validationErrors: errors.array()
        });
    }
    return bcrypt.hash(password, 12)
        .then(hashedPassword => {
            const user = new User(
                {
                    email: email,
                    password: hashedPassword,
                    cart: {items: []}
                });

            return user.save();
        })
        .then((user) => {
            res.redirect('/login');
            return transporter.sendMail({
                to: email,
                from: 'info@express-shop.com',
                subject: 'SignUp succeeded ',
                html: '<h1>Your account was successfully registered!</h1>'
            });
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.getReset = (req, res, next) => {
    const messages = req.flash('error');
    const errorMessage = messages.length > 0 ? messages[0] : null;
    res.render('auth/reset', {
        path: '/reset',
        pageTitle: 'Reset',
        errorMessage: errorMessage
    })
};

exports.postReset = (req, res, next) => {
    crypto.randomBytes(32, (error, buffer) => {
        if (error) {
            return res.redirect('/reset');
        }
        const token = buffer.toString('hex');
        User.findOne({email: req.body.email})
            .then(user => {
                if(!user) {
                    req.flesh('error', 'No account with that email found!')
                }

                user.resetToken = token;
                user.resetTokenExpiration = Date.now() + 3600000;
                return user.save()
            })
            .then(result => {
                res.redirect('/');
               return transporter.sendMail({
                   to: req.body.email,
                   from: 'info@express-shop.com',
                   subject: 'Password Reset',
                   html: `
                      <p>You requested a password reset!</p>
                      <p>Click this <a href="http://localhost:3000/reset/${token}">link</a> to set a new password:</p>
                   `
               });
            })
            .catch(err => {
                console.error(err);
            })
    })
};

exports.getNewPassword = (req, res, next) => {
    const token = req.params.token;
    User.findOne({
        resetToken: token,
        resetTokenExpiration: {$gt: Date.now()},
    })
        .then(user => {
            const messages = req.flash('error');
            const errorMessage = messages.length > 0 ? messages[0] : null;
            res.render('auth/new-password', {
                path: '/new-password',
                pageTitle: 'New Password',
                errorMessage: errorMessage,
                userId: user._id.toString(),
                passwordToken: token
            })
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};

exports.postNewPassword = (req, res, next) => {
    const newPassword = req.body.password;
    const userId = req.body.userId;
    const token = req.body.passwordToken;
    let resetUser;
    User.findOne({
        resetToken: token,
        resetTokenExpiration: {$gt: Date.now()},
        _id: userId
    })
        .then(user => {
            resetUser = user;
            return bcrypt.hash(newPassword, 12)
        })
        .then(password => {
            resetUser.password = password;
            resetUser.resetToken = null;
            resetUser.resetTokenExpiration = undefined;
            return resetUser.save()
        })
        .then(() => {
            res.redirect('/login')
        })
        .catch(err => {
            const error = new Error(err);
            error.httpStatusCode = 500;
            return next(error);
        })
};