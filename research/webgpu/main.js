console.log('navigator.userAgent:', navigator.userAgent)
const {gpu} = navigator
console.log('navigator.gpu:', gpu)

const preferredCanvasFormat = gpu.getPreferredCanvasFormat()
console.log('gpu.preferredCanvasFormat:', preferredCanvasFormat)

const adapter = await gpu.requestAdapter()
console.log('adapter:', adapter)
console.log('adapter.features:', [...adapter.features])

const device = await adapter.requestDevice()
console.log('device:', device)

const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

canvas.width = 200
canvas.height = 200

const context = canvas.getContext('webgpu')
console.log('canvas context:', context)

context.configure({
  device,
  format: preferredCanvasFormat,
  // alphaMode: 'premultiplied',
})
// const vertWgsl = await (await fetch('vert.wgsl')).text()
// const fragWgsl = await (await fetch('frag.wgsl')).text()
debugger
const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: vertWgsl,
    }),
    entryPoint: 'main',
  },
  fragment: {
    module: device.createShaderModule({
      code: fragWgsl,
    }),
    entryPoint: 'main',
    targets: [
      {
        format: preferredCanvasFormat,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',
  },
})
console.log('pipeline:', pipeline)

const commandEncoder = device.createCommandEncoder()
console.log('commandEncoder:', commandEncoder)

const textureView = context.getCurrentTexture().createView()
console.log('textureView:', textureView)

const renderPassDescriptor = {
  colorAttachments: [
    {
      view: textureView,
      clearValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      loadOp: 'clear',
      storeOp: 'store',
    },
  ],
}
const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
console.log('passEncoder:', passEncoder)

passEncoder.setPipeline(pipeline)
passEncoder.draw(3)
passEncoder.end()

device.queue.submit([
  commandEncoder.finish()
])