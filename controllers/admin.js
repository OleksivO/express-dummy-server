const Product = require('../models/product');
const {validationResult} = require('express-validator/check');

exports.getAddProduct = (req, res, next) => {
    res.render('admin/edit-product', {
        pageTitle: 'Add Product',
        path: '/admin/add-product',
        hasError: false,
        editing: false,
        errorMessage: null,
        validationErrors: []
    });
};

exports.getEditProduct = (req, res, next) => {
    const editMode = req.query['edit'];
    if(!editMode) {
       return res.redirect('/')
    }
    const productId = req.params['productId'];
    Product.findById(productId)
        .then(product => {
            if(!product) {
                return res.redirect('/');
            }
            res.render('admin/edit-product', {
                pageTitle: 'Edit Product',
                path: '/admin/edit-product',
                editing: editMode,
                hasError: false,
                errorMessage: null,
                product: product,
                validationErrors: []
            });
        })
        .catch(err => console.error('DB error', err))
};

exports.postEditProduct = (req, res, next) => {
    const {productId, title, imageUrl, price, description} = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Edit Product',
            path: '/admin/add-product',
            editing: true,
            hasError: true,
            product: {title, imageUrl, price, description, _id: productId},
            validationErrors: errors.array(),
            errorMessage: errors.array()[0].msg
        });
    }
    // const product = new Product(title, price, description, imageUrl, productId);
    Product.findById(productId)
        .then(product => {
            if (product.userId.toString() !== req.user._id.toString()) {
                return res.redirect('/')
            }
            product.title = title;
            product.price = price;
            product.description = description;
            product.imageUrl = imageUrl;
            return product.save().then(() => res.redirect('/admin/products'))
        })
        .catch(err => console.error('DB error', err))
};

exports.postAddProduct = (req, res, next) => {
    const {title, imageUrl, price, description} = req.body;
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(422).render('admin/edit-product', {
            pageTitle: 'Add Product',
            path: '/admin/add-product',
            editing: false,
            hasError: true,
            product: {title, imageUrl, price, description},
            validationErrors: errors.array(),
            errorMessage: errors.array()[0].msg
        });
    }

    const product = new Product({
        title,
        price,
        description,
        imageUrl,
        userId: req.user
    });
    product
        .save()
        .then(() => res.redirect('/admin/products'))
        .catch(error => console.error('DB error', error))
};

exports.getProducts = (req, res, next) => {
    Product.find({userId: req.user._id})
        .then(products => {
            res.render('admin/products', {
                prods: products,
                pageTitle: 'Admin products',
                path: '/admin/products'
            });
        })
        .catch(err => console.error('DB error', err))
};

exports.postDeleteProduct = (req, res, next) => {
    const prodId = req.body.productId;
    Product.deleteOne({_id: prodId, userId: req.user._id})
        .then(() => res.redirect('/admin/products'))
        .catch(err => console.error('DB error', err));
};