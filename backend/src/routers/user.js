const express = require('express')
const User = require('../models/user')
const auth = require('../middleware/auth')
const router = new express.Router()
const multer=require('multer')
const sharp=require('sharp')


const {sendWelcomeEmail,cancelEmail}=require('../mails/accounts')
router.post('/users', async (req, res) => {
    const user = new User(req.body)

    try {
        await user.save()
        sendWelcomeEmail(user.name,user.email)
        const token = await user.generateAuthToken()

        res.status(201).send({ user, token })
    } catch (e) {
        res.status(400).send(e)
    }
})

router.post('/users/login', async (req, res) => {
    try {
        const user = await User.findByCredentials(req.body.email, req.body.password)
        const token = await user.generateAuthToken()
        res.send({ user, token })
    } catch (e) {
        res.status(400).send()
    }
})

router.post('/users/logout', auth, async (req, res) => {
    try {
        req.user.tokens = req.user.tokens.filter((token) => {
            return token.token !== req.token
        })
        await req.user.save()

        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.post('/users/logoutAll', auth, async (req, res) => {
    try {
        req.user.tokens = []
        await req.user.save()
        res.send()
    } catch (e) {
        res.status(500).send()
    }
})

router.get('/users/me', auth, async (req, res) => {
    res.send(req.user)
})

router.patch('/users/me', auth, async (req, res) => {
    const updates = Object.keys(req.body)
    const allowedUpdates = ['name', 'email', 'password', 'age']
    const isValidOperation = updates.every((update) => allowedUpdates.includes(update))

    if (!isValidOperation) {
        return res.status(400).send({ error: 'Invalid updates!' })
    }

    try {
        updates.forEach((update) => req.user[update] = req.body[update])
        await req.user.save()
        res.send(req.user)
    } catch (e) {
        res.status(400).send(e)
    }
})

router.delete('/users/me', auth, async (req, res) => {
    try {
        await req.user.remove()
        cancelEmail(req.user.name,req.user.email)
        res.send(req.user)
    } catch (e) {
        res.status(500).send()
    }
})

const avatar=multer({
    
    limits:{
        fileSize:10000000
    },
    fileFilter(req,file,cb){
     if(!file.originalname.match(/\.(jpg|jpeg|png)$/)){
         return cb(new Error('Invalid file format'))
     }
     cb(undefined,true)
    }
})
router.post('/users/me/avatar',auth,avatar.single('avatar'),async (req,res)=>{
    const buffer=await sharp(req.file.buffer).resize({width:225,height:225}).png().toBuffer()
    req.user.avatar=buffer
    await req.user.save()
    res.send()
},(error,req,res,next)=>{
    res.status(400).send({error:error.message})
})

router.delete('/users/me/avatar',auth,async(req,res)=>{
    try{
    req.user.avatar=undefined
    await req.user.save()
    res.send()
    }
    catch(e){
        res.status(400).send(e)
    }
})
router.get('/users/:id/avatar',async (req,res)=>{
    try{
        const user=await User.findById(req.params.id)
        if(!user||!user.avatar){
            throw new Error('Something went wrong')
        }
        res.set('Content-Type','image/png')
        res.send(user.avatar)

    }
    catch(e){
        res.status(400).send({error:e})
    }
})

module.exports = router