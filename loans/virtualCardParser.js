const { parse } = require('node-html-parser')

exports.parseVirtualCardFrame = (cardFrameHTML) => {
  console.log(cardFrameHTML)
  const dom = parse(cardFrameHTML)
  const cardNumber = dom.childNodes[1].childNodes[1].childNodes[0].childNodes[1].childNodes[1].childNodes[0]._rawText
  const cvc = dom.childNodes[1].childNodes[1].childNodes[0].childNodes[1].childNodes[3].childNodes[0]._rawText
  return {
    cardNumber,
    cvc
  }
}
