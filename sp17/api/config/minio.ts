import * as Minio from 'minio'

const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'localhost',
  port: parseInt(process.env.MINIO_PORT || '9000', 10),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
})

const BUCKET = process.env.MINIO_BUCKET || 'cryptnote'

export { minioClient, BUCKET }

export async function ensureBucket() {
  try {
    const exists = await minioClient.bucketExists(BUCKET)
    if (!exists) {
      await minioClient.makeBucket(BUCKET)
      console.log(`MinIO bucket "${BUCKET}" created`)
    }
  } catch (error) {
    console.error('MinIO bucket check/create error:', error)
    process.exit(1)
  }
}
