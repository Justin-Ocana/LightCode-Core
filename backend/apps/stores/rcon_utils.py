"""
RCON Utilities - Encriptación y manejo seguro de credenciales RCON
"""
from cryptography.fernet import Fernet
from django.conf import settings
import base64
import hashlib


def get_encryption_key():
    """
    Genera una clave de encriptación basada en SECRET_KEY
    Usa Fernet (AES 128 en modo CBC con HMAC)
    """
    # Derivar clave de 32 bytes desde SECRET_KEY
    key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(key)


def encrypt_rcon_password(password: str) -> str:
    """
    Encripta la contraseña RCON usando Fernet
    
    Args:
        password: Contraseña en texto plano
        
    Returns:
        Contraseña encriptada (base64)
    """
    if not password:
        return ''
    
    fernet = Fernet(get_encryption_key())
    encrypted = fernet.encrypt(password.encode())
    return encrypted.decode()


def decrypt_rcon_password(encrypted_password: str) -> str:
    """
    Desencripta la contraseña RCON
    
    Args:
        encrypted_password: Contraseña encriptada
        
    Returns:
        Contraseña en texto plano
    """
    if not encrypted_password:
        return ''
    
    try:
        fernet = Fernet(get_encryption_key())
        decrypted = fernet.decrypt(encrypted_password.encode())
        return decrypted.decode()
    except Exception:
        # Si falla la desencriptación, retornar vacío
        return ''
