"""
RCON Service - Implementación correcta del protocolo Source RCON
Basado en: https://developer.valvesoftware.com/wiki/Source_RCON_Protocol

Formato de paquete RCON:
- Size (int32 LE): Tamaño del resto del paquete (sin incluir este campo)
- ID (int32 LE): Request ID para matching request/response
- Type (int32 LE): Tipo de paquete (3=auth, 2=command, 0=response)
- Body (string): Payload terminado en null
- Empty String (null byte): Padding adicional

Todos los enteros son little-endian de 32 bits.
"""
import socket
import struct
import time
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


@dataclass
class RCONResponse:
    """Respuesta de un comando RCON"""
    success: bool
    response: str
    latency: int  # en ms
    error: Optional[str] = None
    timestamp: str = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now().isoformat()


class RCONClient:
    """
    Cliente RCON para Minecraft/Source servers
    Implementación correcta del protocolo Source RCON
    """
    
    # Tipos de paquete según el protocolo Source RCON
    SERVERDATA_AUTH = 3
    SERVERDATA_AUTH_RESPONSE = 2
    SERVERDATA_EXECCOMMAND = 2
    SERVERDATA_RESPONSE_VALUE = 0
    
    def __init__(self, host: str, port: int, password: str, timeout: int = 10, debug: bool = False):
        self.host = host
        self.port = port
        self.password = password
        self.timeout = timeout
        self.socket = None
        self.authenticated = False
        self.debug = debug
        self.request_id = 0
        
    def _get_request_id(self) -> int:
        """Genera un request ID único"""
        self.request_id += 1
        return self.request_id
    
    def _pack_packet(self, packet_id: int, packet_type: int, body: str) -> bytes:
        """
        Empaqueta un paquete RCON según el protocolo Source
        
        Estructura:
        - Size (4 bytes, int32 LE): tamaño de ID + Type + Body + 2 null bytes
        - ID (4 bytes, int32 LE)
        - Type (4 bytes, int32 LE)
        - Body (string ASCII/UTF-8)
        - Null terminator (1 byte)
        - Empty string null terminator (1 byte)
        """
        # Codificar el body
        body_bytes = body.encode('utf-8')
        
        # Calcular tamaño: ID (4) + Type (4) + Body + Null (1) + Empty (1)
        size = 4 + 4 + len(body_bytes) + 2
        
        # Empaquetar: Size + ID + Type + Body + 2 null bytes
        packet = struct.pack('<i', size)  # Size (little-endian int32)
        packet += struct.pack('<i', packet_id)  # ID
        packet += struct.pack('<i', packet_type)  # Type
        packet += body_bytes  # Body
        packet += b'\x00\x00'  # Null terminator + Empty string
        
        if self.debug:
            print(f"[DEBUG] Paquete empaquetado: size={size}, id={packet_id}, type={packet_type}, body_len={len(body_bytes)}")
        
        return packet
    
    def _unpack_packet(self, data: bytes) -> Tuple[int, int, str]:
        """
        Desempaqueta un paquete RCON
        
        Retorna: (packet_id, packet_type, body)
        """
        if len(data) < 14:  # Mínimo: 4 (size) + 4 (id) + 4 (type) + 2 (nulls)
            raise ValueError(f"Paquete muy corto: {len(data)} bytes (mínimo 14)")
        
        # Leer size (primeros 4 bytes)
        size = struct.unpack('<i', data[:4])[0]
        
        # Leer ID (bytes 4-8)
        packet_id = struct.unpack('<i', data[4:8])[0]
        
        # Leer Type (bytes 8-12)
        packet_type = struct.unpack('<i', data[8:12])[0]
        
        # Leer Body (desde byte 12 hasta los 2 últimos bytes que son nulls)
        body = data[12:-2].decode('utf-8', errors='ignore')
        
        if self.debug:
            print(f"[DEBUG] Paquete desempaquetado: size={size}, id={packet_id}, type={packet_type}, body_len={len(body)}")
        
        return packet_id, packet_type, body
    
    def _read_response(self) -> bytes:
        """
        Lee una respuesta completa del servidor
        Maneja el caso de respuestas multi-paquete
        """
        # Primero leer el tamaño del paquete (4 bytes)
        size_data = self.socket.recv(4)
        if not size_data or len(size_data) < 4:
            raise ConnectionError("Servidor cerró la conexión o respuesta incompleta")
        
        size = struct.unpack('<i', size_data)[0]
        
        if self.debug:
            print(f"[DEBUG] Esperando {size} bytes de payload")
        
        # Leer el resto del paquete
        remaining = size
        data = size_data
        
        while remaining > 0:
            chunk = self.socket.recv(min(remaining, 4096))
            if not chunk:
                raise ConnectionError("Conexión cerrada mientras se leía el paquete")
            data += chunk
            remaining -= len(chunk)
        
        if self.debug:
            print(f"[DEBUG] Recibidos {len(data)} bytes totales")
        
        return data
    
    def connect(self) -> RCONResponse:
        """Conecta y autentica con el servidor RCON"""
        start_time = time.time()
        
        try:
            # Validar que el host no contenga puerto
            if ':' in self.host:
                return RCONResponse(
                    success=False,
                    response="",
                    latency=0,
                    error="INVALID_HOST_FORMAT"
                )
            
            if self.debug:
                print(f"[DEBUG] Conectando a {self.host}:{self.port}")
            
            # Crear socket TCP
            self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.socket.settimeout(self.timeout)
            self.socket.connect((self.host, self.port))
            
            if self.debug:
                print(f"[DEBUG] Conexión TCP establecida")
            
            # Enviar paquete de autenticación con ID=0 (importante para Minecraft)
            auth_packet = self._pack_packet(0, self.SERVERDATA_AUTH, self.password)
            self.socket.send(auth_packet)
            
            if self.debug:
                print(f"[DEBUG] Paquete de autenticación enviado (ID=0, password_len={len(self.password)})")
            
            # Leer respuesta de autenticación
            try:
                response_data = self._read_response()
                packet_id, packet_type, body = self._unpack_packet(response_data)
                
                if self.debug:
                    print(f"[DEBUG] Respuesta auth: ID={packet_id}, Type={packet_type}, Body='{body}'")
                
                # Si el packet_id es -1, la autenticación falló
                if packet_id == -1:
                    if self.debug:
                        print(f"[DEBUG] Autenticación rechazada (packet_id=-1)")
                    return RCONResponse(
                        success=False,
                        response="",
                        latency=int((time.time() - start_time) * 1000),
                        error="AUTH_FAILED"
                    )
                
                # Si el ID es 0, autenticación exitosa
                if packet_id == 0:
                    self.authenticated = True
                    latency = int((time.time() - start_time) * 1000)
                    
                    if self.debug:
                        print(f"[DEBUG] Autenticación exitosa en {latency}ms")
                    
                    return RCONResponse(
                        success=True,
                        response="Connected successfully",
                        latency=latency
                    )
                else:
                    if self.debug:
                        print(f"[DEBUG] ID inesperado: {packet_id}")
                    return RCONResponse(
                        success=False,
                        response="",
                        latency=int((time.time() - start_time) * 1000),
                        error="PROTOCOL_ERROR"
                    )
                    
            except (ConnectionResetError, ConnectionAbortedError, ConnectionError) as e:
                if self.debug:
                    print(f"[DEBUG] Conexión cerrada por el servidor: {e}")
                return RCONResponse(
                    success=False,
                    response="",
                    latency=int((time.time() - start_time) * 1000),
                    error="AUTH_FAILED"
                )
            
        except socket.timeout:
            if self.debug:
                print(f"[DEBUG] Timeout después de {self.timeout}s")
            return RCONResponse(
                success=False,
                response="",
                latency=int((time.time() - start_time) * 1000),
                error="TIMEOUT"
            )
        except ConnectionRefusedError:
            if self.debug:
                print(f"[DEBUG] Conexión rechazada")
            return RCONResponse(
                success=False,
                response="",
                latency=int((time.time() - start_time) * 1000),
                error="ECONNREFUSED"
            )
        except socket.gaierror as e:
            if self.debug:
                print(f"[DEBUG] Error de resolución DNS: {e}")
            return RCONResponse(
                success=False,
                response="",
                latency=int((time.time() - start_time) * 1000),
                error="DNS_RESOLUTION_FAILED"
            )
        except Exception as e:
            if self.debug:
                print(f"[DEBUG] Error inesperado: {type(e).__name__}: {e}")
                import traceback
                traceback.print_exc()
            return RCONResponse(
                success=False,
                response="",
                latency=int((time.time() - start_time) * 1000),
                error=str(e)
            )
    
    def execute(self, command: str, simulate: bool = False) -> RCONResponse:
        """Ejecuta un comando RCON"""
        if simulate:
            return RCONResponse(
                success=True,
                response=f"[SIMULATED] Command would execute: {command}",
                latency=0
            )
        
        if not self.authenticated:
            return RCONResponse(
                success=False,
                response="",
                latency=0,
                error="NOT_AUTHENTICATED"
            )
        
        start_time = time.time()
        
        try:
            # Enviar comando con ID=0 (estándar para Minecraft)
            command_packet = self._pack_packet(0, self.SERVERDATA_EXECCOMMAND, command)
            self.socket.send(command_packet)
            
            # Enviar paquete de terminación con ID=1 para detectar fin de respuesta
            end_packet = self._pack_packet(1, self.SERVERDATA_EXECCOMMAND, "")
            self.socket.send(end_packet)
            
            if self.debug:
                print(f"[DEBUG] Comando enviado: cmd='{command}'")
            
            # Leer respuestas hasta encontrar el paquete de terminación
            response_text = ""
            while True:
                response_data = self._read_response()
                packet_id, packet_type, body = self._unpack_packet(response_data)
                
                if self.debug:
                    print(f"[DEBUG] Respuesta: ID={packet_id}, Type={packet_type}, Body_len={len(body)}")
                
                # Si recibimos el paquete de terminación (ID=1), terminamos
                if packet_id == 1:
                    break
                
                # Acumular respuesta
                if packet_id == 0:
                    response_text += body.decode('utf-8') if isinstance(body, bytes) else body
            
            latency = int((time.time() - start_time) * 1000)
            
            if self.debug:
                print(f"[DEBUG] Comando completado en {latency}ms")
            
            return RCONResponse(
                success=True,
                response=response_text,
                latency=latency
            )
            
        except socket.timeout:
            return RCONResponse(
                success=False,
                response="",
                latency=int((time.time() - start_time) * 1000),
                error="TIMEOUT"
            )
        except Exception as e:
            if self.debug:
                print(f"[DEBUG] Error ejecutando comando: {e}")
                import traceback
                traceback.print_exc()
            return RCONResponse(
                success=False,
                response="",
                latency=int((time.time() - start_time) * 1000),
                error=str(e)
            )
    
    def disconnect(self):
        """Desconecta del servidor"""
        if self.socket:
            try:
                self.socket.close()
            except:
                pass
            self.socket = None
            self.authenticated = False


class RCONTester:
    """Herramienta de testing para RCON"""
    
    @staticmethod
    def classify_rcon_error(error_message: str, error_code: Optional[str] = None) -> str:
        """
        Clasifica un error RCON en categorías para determinar estrategia de reintento.
        
        Returns:
            Una de: network_error, auth_error, command_error, player_offline_error, unknown
            (valores de enum, no nombres de constantes)
        """
        if not error_message and not error_code:
            return 'unknown'
        
        error_text = (error_message or '').lower() + ' ' + (error_code or '').lower()
        
        # Errores de autenticación
        auth_patterns = [
            'wrong password', 'auth failed', 'authentication', 
            'incorrect password', 'invalid password', 'auth_failed'
        ]
        if any(pattern in error_text for pattern in auth_patterns):
            return 'auth_error'
        
        # Errores de jugador offline/no existe
        player_patterns = [
            'player does not exist', 'player not found', 
            'player is not online', 'not online', 'no player was found',
            'that player does not exist', 'player_offline',
            'no hay jugadores conectados', 'no players online', '0 players online'
        ]
        if any(pattern in error_text for pattern in player_patterns):
            return 'player_offline_error'
        
        # Errores de comando
        command_patterns = [
            'unknown command', 'invalid command', 'command not found',
            'incorrect argument', 'usage:', 'syntax error'
        ]
        if any(pattern in error_text for pattern in command_patterns):
            return 'command_error'
        
        # Errores de red
        network_patterns = [
            'connection refused', 'timeout', 'connection reset',
            'econnrefused', 'timed out', 'connection closed',
            'dns_resolution_failed', 'getaddrinfo failed', 'network unreachable'
        ]
        if any(pattern in error_text for pattern in network_patterns):
            return 'network_error'
        
        return 'unknown'
    
    @staticmethod
    def test_connection(host: str, port: int, password: str, debug: bool = False) -> Dict:
        """Prueba la conexión RCON"""
        client = RCONClient(host, port, password, debug=debug)
        response = client.connect()
        client.disconnect()
        
        return {
            'status': 'connected' if response.success else 'error',
            'latency': response.latency,
            'error': response.error,
            'message': RCONTester._translate_error(response.error) if response.error else 'Connection successful'
        }
    
    @staticmethod
    def stress_test(host: str, port: int, password: str, iterations: int = 10) -> Dict:
        """Prueba de estrés RCON"""
        results = []
        failures = []
        total_latency = 0
        
        for i in range(iterations):
            client = RCONClient(host, port, password)
            response = client.connect()
            
            if response.success:
                # Ejecutar comando de prueba
                cmd_response = client.execute('list')
                results.append({
                    'iteration': i + 1,
                    'success': cmd_response.success,
                    'latency': cmd_response.latency
                })
                total_latency += cmd_response.latency
            else:
                failures.append(response.error)
                results.append({
                    'iteration': i + 1,
                    'success': False,
                    'error': response.error
                })
            
            client.disconnect()
            time.sleep(0.1)
        
        success_count = sum(1 for r in results if r.get('success', False))
        success_rate = (success_count / iterations) * 100
        avg_latency = total_latency / success_count if success_count > 0 else 0
        
        return {
            'iterations': iterations,
            'success_count': success_count,
            'success_rate': round(success_rate, 2),
            'avg_latency': round(avg_latency, 2),
            'failures': failures,
            'results': results,
            'recommendation': 'stable' if success_rate >= 90 else 'unstable'
        }
    
    @staticmethod
    def batch_test(host: str, port: int, password: str, commands: List[str]) -> Dict:
        """Prueba de comandos en batch"""
        client = RCONClient(host, port, password)
        connect_response = client.connect()
        
        if not connect_response.success:
            return {
                'success': False,
                'error': connect_response.error,
                'message': RCONTester._translate_error(connect_response.error)
            }
        
        results = []
        total_time = 0
        
        for cmd in commands:
            response = client.execute(cmd)
            results.append({
                'command': cmd,
                'success': response.success,
                'response': response.response,
                'latency': response.latency,
                'error': response.error
            })
            total_time += response.latency
        
        client.disconnect()
        
        return {
            'success': True,
            'total_commands': len(commands),
            'total_time': total_time,
            'avg_time_per_command': round(total_time / len(commands), 2) if commands else 0,
            'results': results
        }
    
    @staticmethod
    def check_player_online(host: str, port: int, password: str, username: str) -> Dict:
        """
        Verifica si un jugador está online en el servidor
        
        Returns:
            {
                'online': bool,
                'username': str,
                'players_online': list,
                'total_players': int,
                'max_players': int,
                'error': str (opcional)
            }
        """
        client = RCONClient(host, port, password)
        connect_response = client.connect()
        
        if not connect_response.success:
            return {
                'online': False,
                'username': username,
                'error': connect_response.error,
                'message': RCONTester._translate_error(connect_response.error)
            }
        
        # Ejecutar comando 'list' para obtener jugadores online
        list_response = client.execute('list')
        client.disconnect()
        
        if not list_response.success:
            return {
                'online': False,
                'username': username,
                'error': list_response.error,
                'message': 'Failed to get player list'
            }
        
        # Parsear respuesta del comando 'list'
        # Formato: "There are X of a max of Y players online: player1, player2, player3"
        response_text = list_response.response.strip()
        
        # Extraer jugadores online
        players_online = []
        total_players = 0
        max_players = 0
        
        try:
            # Buscar el patrón "There are X of a max of Y players online:"
            if 'players online:' in response_text:
                parts = response_text.split('players online:')
                
                # Extraer números de jugadores
                numbers_part = parts[0]
                if 'There are' in numbers_part:
                    numbers = numbers_part.replace('There are', '').replace('of a max of', ',').strip()
                    nums = [int(n.strip()) for n in numbers.split(',') if n.strip().isdigit()]
                    if len(nums) >= 2:
                        total_players = nums[0]
                        max_players = nums[1]
                
                # Extraer lista de jugadores
                if len(parts) > 1:
                    players_part = parts[1].strip()
                    if players_part:
                        players_online = [p.strip() for p in players_part.split(',') if p.strip()]
        except Exception as e:
            # Si falla el parsing, intentar detectar al menos si el jugador está mencionado
            pass
        
        # Verificar si el username está en la lista (case-insensitive)
        username_lower = username.lower()
        is_online = any(player.lower() == username_lower for player in players_online)
        
        return {
            'online': is_online,
            'username': username,
            'players_online': players_online,
            'total_players': total_players,
            'max_players': max_players,
            'raw_response': response_text
        }
    
    @staticmethod
    def test_product_delivery(host: str, port: int, password: str, 
                             username: str, commands: List[str], 
                             validate_online: bool = True) -> Dict:
        """
        Simula la entrega de un producto usando comandos RCON
        Compatible con el sistema de productos de lightcode
        
        Args:
            validate_online: Si True, verifica que el jugador esté online antes de entregar (DEFAULT: True)
        """
        # SIEMPRE validar que el jugador esté online (seguridad)
        player_check = RCONTester.check_player_online(host, port, password, username)
        # SIEMPRE validar que el jugador esté online (seguridad)
        player_check = RCONTester.check_player_online(host, port, password, username)
        
        if 'error' in player_check:
            return {
                'success': False,
                'error': player_check['error'],
                'message': player_check['message'],
                'validation_failed': True
            }
        
        if not player_check['online']:
            return {
                'success': False,
                'error': 'PLAYER_OFFLINE',
                'message': f'Player {username} is not online',
                'username': username,
                'players_online': player_check['players_online'],
                'validation_failed': True
            }
        
        # Proceder con la entrega
        client = RCONClient(host, port, password)
        connect_response = client.connect()
        
        if not connect_response.success:
            return {
                'success': False,
                'error': connect_response.error,
                'message': RCONTester._translate_error(connect_response.error)
            }
        
        # Reemplazar {username} en los comandos
        processed_commands = [cmd.replace('{username}', username) for cmd in commands]
        
        results = []
        all_success = True
        
        for cmd in processed_commands:
            response = client.execute(cmd)
            results.append({
                'command': cmd,
                'success': response.success,
                'response': response.response,
                'latency': response.latency
            })
            
            if not response.success:
                all_success = False
        
        client.disconnect()
        
        return {
            'success': all_success,
            'username': username,
            'commands_executed': len(processed_commands),
            'results': results,
            'message': 'Product delivered successfully' if all_success else 'Some commands failed',
            'validated_online': True  # Siempre validado
        }
    
    @staticmethod
    def _translate_error(error_code: Optional[str]) -> str:
        """Traduce códigos de error a mensajes legibles"""
        translations = {
            'ECONNREFUSED': 'Servidor apagado o puerto incorrecto',
            'AUTH_FAILED': 'Contraseña RCON incorrecta - verifica server.properties y reinicia el servidor',
            'TIMEOUT': 'Tiempo de espera agotado - verifica IP y firewall',
            'NOT_AUTHENTICATED': 'No autenticado - conecta primero',
            'INVALID_PROTOCOL': 'Puerto incorrecto - usa el puerto RCON (no el puerto del juego)',
            'DNS_RESOLUTION_FAILED': 'No se puede resolver el host - verifica la IP/dominio',
            'INVALID_HOST_FORMAT': 'Formato incorrecto - separa IP y puerto en campos diferentes',
            'PROTOCOL_ERROR': 'Error de protocolo - respuesta inesperada del servidor',
        }
        
        # Detectar errores específicos
        if error_code:
            if 'unpack requires a buffer' in error_code:
                return 'Puerto incorrecto - usa el puerto RCON (no el puerto del juego)'
            if 'getaddrinfo failed' in error_code or '11001' in error_code:
                return 'No se puede resolver el host - verifica que la IP/dominio sea correcta y no incluya el puerto'
        
        return translations.get(error_code, error_code or 'Unknown error')
