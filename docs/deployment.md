# Despliegue en AWS Academy

## Infraestructura

Usa una instancia EC2 `t3.medium`, Ubuntu Server 24.04 LTS, arquitectura `x86_64` y un volumen `gp3` de 30 GiB en `us-east-1`. Al crearla, selecciona IMDSv2 obligatorio, hop limit `2` y el perfil de instancia proporcionado por el laboratorio. El Security Group permite `80/tcp` y `443/tcp` desde Internet; limita `22/tcp` a tu dirección IP.

El registro DNS `A` de `mediagnostics.moonshard-wow.com` debe apuntar a la IPv4 pública de EC2. Como AWS Academy bloquea Elastic IP, actualízalo después de cada ciclo `stop/start`.

## Bucket privado

Crea un bucket S3 con nombre globalmente único en `us-east-1`. Habilita bloqueo público, cifrado SSE-S3 y versionado. Aplica la política incluida:

```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket BUCKET_NAME \
  --lifecycle-configuration file://infrastructure/aws/s3-lifecycle.json \
  --region us-east-1
```

La política conserva los respaldos de PostgreSQL durante 14 días, cancela cargas multipart incompletas y no elimina documentos clínicos.

## Configuración

Clona el repositorio en `/opt/mediagnostics`. Copia la plantilla y restringe sus permisos:

```bash
cp infrastructure/env/production.env.example .env.production
chmod 600 .env.production
openssl rand -hex 32
openssl rand -base64 48
openssl rand -base64 32
```

Usa valores hexadecimales distintos para PostgreSQL y Redis, el valor Base64 de 48 bytes para `SESSION_SECRET` y el de 32 bytes para `PDF_ENCRYPTION_KEY`. Completa el bucket y las credenciales del administrador. No agregues este archivo a Git.

## Inicio

Instala Docker Engine, el complemento Docker Compose y AWS CLI. Valida, construye e inicia:

```bash
docker compose --env-file .env.production -f compose.production.yaml config
docker compose --env-file .env.production -f compose.production.yaml build
docker compose --env-file .env.production -f compose.production.yaml up -d
docker compose --env-file .env.production -f compose.production.yaml ps
```

El servicio temporal `migrate` debe terminar con código `0`. Crea el administrador únicamente la primera vez:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  run --rm migrate pnpm db:seed
```

Verifica `https://mediagnostics.moonshard-wow.com/api/v1/health/ready`. Caddy solicitará el certificado cuando el DNS ya apunte a EC2.

## Respaldos

Instala y activa el temporizador diario:

```bash
sudo cp infrastructure/systemd/mediagnostics-backup.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mediagnostics-backup.timer
sudo systemctl start mediagnostics-backup.service
sudo systemctl status mediagnostics-backup.service
```

El respaldo se transmite comprimido desde PostgreSQL hacia S3 sin dejar una copia permanente en EC2.
