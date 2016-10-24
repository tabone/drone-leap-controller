'use strict'

const events = require('events')
const leap = require('leapjs')
const drone = require('drone')
const utils = require('./utils')
const states = require('./states')

const pit = Object.create(events.prototype)

/**
 * Controller used to communicate with Leap Motion.
 * @type {leap.Controller}
 */
pit.controller = new leap.Controller()

/**
 * Current fly / land state.
 * @type {Number}
 */
pit.state = states.LANDED

/**
 * Latest frame from Leap Motion.
 * @type {leap.Frame}
 */
pit.frame = null

/**
 * The hand being tracked for drone commands.
 * @type {leap.Hand}
 */
pit.hand = null

/**
 * Used to connect with Leap Motion device.
 */
pit.connect = function connect () {
  this.controller.connect()
  drone.init()
}

createControllerListeners()

/**
 * The listener invoked when a frame is recieved.
 * @param  {Leap.Frame} frame Frame object.
 * @this {pit}
 */
function onFrame (frame) {
  // Keep a reference of latest frame.
  this.frame = frame

  // If there are no hands, do nothing
  if (utils.areThereHands(frame) === false) return

  // Keep a reference of the hand being monitore.
  this.hand = this.frame.hands[0]

  getFlyLandGesture.call(this)

  getMovementCommands.call(this)
}

/**
 * Used to determine whether the user would like to fly or land the drone.
 */
function getFlyLandGesture () {
  const fingersExtended = this.hand.fingers.map((finger) => {
    return finger.extended
  })

  if (!!~fingersExtended.indexOf(!fingersExtended[0])) return

  if (fingersExtended[0] === true) {
    if (this.state !== states.LANDED) return
    this.state = states.TAKING_OFF
    drone.takeOff()()
      .then(() => {
        this.state = states.FLYING
      })
  } 
  
  if (fingersExtended[0] === false) {
    if (this.state !== states.FLYING) return
    this.state = states.LANDING
    drone.land()()
      .then(() => {
        this.state = states.LANDED
      })
  }
}

function getMovementCommands () {
  if (this.state !== states.FLYING) return

  return Promise.all([
    getPitch.call(this),
    getRoll.call(this),
    getYaw.call(this)
  ])
}

function getPitch () {
  if (this.hand.pitch() < -0.5) {
    return drone.moveForward()()
  }

  if (this.hand.pitch () > 0.5) {
    return drone.moveBack()()
  }

  return drone.resetPitch()()
}

function getRoll () {
  if (this.hand.roll() < -0.5) {
    return drone.moveLeft()()
  }

  if (this.hand.roll() > 0.5) {
    return drone.moveRight()()
  }

  return drone.resetRoll()()
}

function getYaw () {
  if (this.hand.yaw() < -0.5) {
    return drone.spinLeft()()
  }

  if (this.hand.yaw() > 0.5) {
    return drone.spinRight()()
  }

  return drone.resetYaw()()
}

/**
 * Used to create the leap controller listeners.
 */
function createControllerListeners () {
  pit.controller.on('connect', () => {
    console.info('connection established with leap motion')
  })

  pit.controller.on('disconnect', () => {
    console.info('disconnected from leap motion')
  })

  pit.controller.on('frame', onFrame.bind(pit))
}

module.exports = pit
