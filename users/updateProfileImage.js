const { PollenError } = require('utils')
const { imageTooLarge } = require('messages')
const { putPNG } = require('aws-layer')
const { update } = require('./update')
const { nanoid } = require('nanoid')

exports.updateProfileImage = async (request) => {
  const { image, userName } = request

  // decode the image
  const decodedImage = Buffer.from(image, 'base64')
  if (decodedImage.length > 1024 * 1024 * 10) { throw new PollenError(imageTooLarge) }

  const fileName = `${nanoid()}.png`
  const profileURL = await putPNG(fileName, decodedImage)

  await update({
    userName,
    details: {
      profileURL
    }
  })

  // TODO Zendesk integration
}
