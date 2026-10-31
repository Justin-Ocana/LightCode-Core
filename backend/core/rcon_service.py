"""
RCON Service - Servicio centralizado para entregas automáticas
Usado por: Stores, Orders, Admin Tools

Este servicio maneja:
1. Conexión RCON con credenciales de la tienda
2. Validación de jugador online
3. Ejecución de comandos con reemplazo de variables
4. Logging de entregas
"""
import logging
from typing import Dict, List, Optional
from apps.admin_tools.rcon_service import RCONClient

logger = logging.getLogger(__name__)


class RCONDeliveryService:
    """
    Servicio de entrega automática vía RCON
    
    Flujo de entrega:
    1. Verificar que el servidor esté encendido
    2. Verificar que el jugador esté online
    3. Ejecutar comandos con reemplazo de {username}
    4. Retornar resultado detallado
    """
    
    @staticmethod
    def deliver_product(
        host: str,
        port: int,
        password: str,
        username: str,
        commands: List[str],
        validate_online: bool = True,
        store_slug: str = None
    ) -> Dict:
        """
        Entrega un producto a un jugador vía RCON
        
        Args:
            host: IP o dominio del servidor
            port: Puerto RCON
            password: Contraseña RCON (ya desencriptada)
            username: Nombre del jugador
            commands: Lista de comandos a ejecutar
            validate_online: Si True, verifica que el jugador esté online
            store_slug: Slug de la tienda (para logging)
        
        Returns:
            {
                'success': bool,
                'username': str,
                'commands_executed': int,
                'results': [{'command': str, 'response': str, 'success': bool}],
                'validation_failed': bool (opcional),
                'error': str (opcional),
                'message': str
            }
        """
        log_prefix = f"[RCON Delivery - {store_slug or 'Unknown'}]"
        
        # Paso 1: Conectar al servidor
        logger.info(f"{log_prefix} Iniciando entrega para {username}")
        
        # Crear una nueva conexión para cada sub-comando (más estable)
        # En lugar de reutilizar la misma conexión
        
        # Primero validar jugador online
        client = RCONClient(host, port, password)
        connect_response = client.connect()
        
        if not connect_response.success:
            from apps.admin_tools.rcon_service import RCONTester
            error_msg = RCONTester._translate_error(connect_response.error)
            logger.error(f"{log_prefix} Error de conexión: {error_msg}")
            return {
                'success': False,
                'error': connect_response.error,
                'message': f'No se pudo conectar al servidor: {error_msg}',
                'validation_failed': True
            }
        
        logger.info(f"{log_prefix} Conectado exitosamente ({connect_response.latency}ms)")
        
        # Paso 2: Validar que el jugador esté online
        if validate_online:
            logger.info(f"{log_prefix} Validando que {username} esté online...")
            
            list_response = client.execute('list')
            
            # Si falla, reintentar una vez (puede ser rate limiting temporal)
            if not list_response.success:
                logger.warning(f"{log_prefix} Primer intento de 'list' falló: {list_response.error}, reintentando...")
                
                # Desconectar y reconectar para obtener una conexión fresca
                client.disconnect()
                import time
                time.sleep(1.0)  # Esperar 1 segundo (aumentado de 0.5s)
                
                reconnect_response = client.connect()
                if not reconnect_response.success:
                    from apps.admin_tools.rcon_service import RCONTester
                    logger.error(f"{log_prefix} No se pudo reconectar: {reconnect_response.error}")
                    return {
                        'success': False,
                        'error': 'RECONNECT_FAILED',
                        'message': 'No se pudo reconectar al servidor RCON',
                        'validation_failed': True
                    }
                
                list_response = client.execute('list')
                
                if not list_response.success:
                    logger.error(f"{log_prefix} Segundo intento también falló: {list_response.error}")
                    # Intentar un tercer intento con más delay
                    client.disconnect()
                    time.sleep(2.0)
                    
                    third_connect = client.connect()
                    if third_connect.success:
                        list_response = client.execute('list')
                        if not list_response.success:
                            logger.error(f"{log_prefix} Tercer intento también falló: {list_response.error}")
                    else:
                        logger.error(f"{log_prefix} No se pudo conectar en tercer intento")
            
            if not list_response.success:
                client.disconnect()
                logger.error(f"{log_prefix} Error al obtener lista de jugadores después de 3 intentos")
                return {
                    'success': False,
                    'error': 'LIST_COMMAND_FAILED',
                    'message': 'El servidor RCON no responde correctamente. Puede estar sobrecargado o tener problemas de red.',
                    'validation_failed': True
                }
            
            response_text = list_response.response.strip()
            logger.info(f"{log_prefix} Respuesta del servidor: {response_text}")
            
            # Extraer jugadores online de la respuesta
            players_online = []
            player_count = 0
            
            # Formato típico: "There are X of a max of Y players online: player1, player2"
            if 'players online:' in response_text.lower():
                parts = response_text.split(':')
                
                # Extraer número de jugadores
                if 'there are' in parts[0].lower():
                    try:
                        # Buscar el primer número (cantidad de jugadores online)
                        import re
                        numbers = re.findall(r'\d+', parts[0])
                        if numbers:
                            player_count = int(numbers[0])
                    except:
                        pass
                
                # Extraer lista de jugadores (después de ":")
                if len(parts) > 1:
                    players_str = parts[1].strip()
                    if players_str:
                        players_online = [p.strip() for p in players_str.split(',') if p.strip()]
            
            logger.info(f"{log_prefix} Jugadores detectados: {player_count} online - Lista: {players_online}")
            
            # Verificar si hay jugadores online
            if player_count == 0 or len(players_online) == 0:
                client.disconnect()
                logger.warning(f"{log_prefix} ✗ No hay jugadores conectados al servidor")
                return {
                    'success': False,
                    'validation_failed': True,
                    'error': 'NO_PLAYERS_ONLINE',
                    'message': 'No hay jugadores conectados al servidor',
                    'username': username,
                    'players_online': [],
                    'server_response': response_text
                }
            
            # Verificar si el jugador específico está en la lista (case-insensitive)
            username_lower = username.lower()
            player_found = any(player.lower() == username_lower for player in players_online)
            
            if not player_found:
                client.disconnect()
                logger.warning(f"{log_prefix} ✗ Jugador {username} no está online. Jugadores conectados: {players_online}")
                return {
                    'success': False,
                    'validation_failed': True,
                    'error': 'PLAYER_OFFLINE',
                    'message': f'El jugador {username} no está conectado al servidor',
                    'username': username,
                    'players_online': players_online,
                    'server_response': response_text
                }
            
            logger.info(f"{log_prefix} ✓ Jugador {username} está online")
        
        # Cerrar la conexión de validación
        client.disconnect()
        
        # Paso 3: Ejecutar comandos (crear nueva conexión para cada comando)
        logger.info(f"{log_prefix} Ejecutando {len(commands)} comandos...")
        
        # 🔴 VALIDAR: No puede haber 0 comandos
        if not commands or len(commands) == 0:
            logger.error(f"{log_prefix} ✗ No hay comandos para ejecutar")
            return {
                'success': False,
                'error': 'NO_COMMANDS',
                'message': 'No hay comandos configurados para este producto',
                'username': username,
                'commands_executed': 0,
                'results': []
            }
        
        results = []
        all_success = True
        
        for i, cmd in enumerate(commands, 1):
            # Reemplazar variables
            final_cmd = cmd.replace('{username}', username)
            
            # Si el comando contiene ';', dividirlo en múltiples comandos
            # Minecraft RCON no soporta múltiples comandos con ';' en una sola llamada
            sub_commands = [c.strip() for c in final_cmd.split(';') if c.strip()]
            
            logger.info(f"{log_prefix} [{i}/{len(commands)}] Ejecutando {len(sub_commands)} sub-comandos")
            
            for j, sub_cmd in enumerate(sub_commands, 1):
                logger.info(f"{log_prefix} [{i}/{len(commands)}][{j}/{len(sub_commands)}] Ejecutando: {sub_cmd}")
                
                # Crear nueva conexión para cada sub-comando (más estable)
                cmd_client = RCONClient(host, port, password)
                cmd_connect = cmd_client.connect()
                
                if not cmd_connect.success:
                    logger.error(f"{log_prefix} No se pudo conectar para ejecutar comando: {cmd_connect.error}")
                    results.append({
                        'command': sub_cmd,
                        'response': '',
                        'success': False,
                        'latency': 0
                    })
                    all_success = False
                    continue
                
                response = cmd_client.execute(sub_cmd)
                cmd_client.disconnect()
                
                results.append({
                    'command': sub_cmd,
                    'response': response.response or '',
                    'success': response.success,
                    'latency': response.latency
                })
                
                if response.success:
                    logger.info(f"{log_prefix} [{i}/{len(commands)}][{j}/{len(sub_commands)}] ✓ Éxito ({response.latency}ms)")
                else:
                    logger.error(f"{log_prefix} [{i}/{len(commands)}][{j}/{len(sub_commands)}] ✗ Error: {response.error}")
                    all_success = False
                
                # Pequeño delay entre comandos para evitar rate limiting
                if j < len(sub_commands):
                    import time
                    time.sleep(0.5)  # Aumentado de 0.2s a 0.5s
        
        client.disconnect()
        
        # Resultado final
        if all_success:
            logger.info(f"{log_prefix} ✓ Entrega completada exitosamente para {username}")
            return {
                'success': True,
                'username': username,
                'commands_executed': len(commands),
                'results': results,
                'message': 'Producto entregado exitosamente',
                'validated_online': validate_online
            }
        else:
            # 🔴 ENTREGA PARCIAL: Algunos comandos fallaron
            successful_commands = [r['command'] for r in results if r['success']]
            failed_commands = [r['command'] for r in results if not r['success']]
            
            logger.warning(f"{log_prefix} ⚠ Entrega parcial para {username} - {len(successful_commands)}/{len(results)} comandos exitosos")
            return {
                'success': False,
                'partial_success': True,
                'username': username,
                'commands_executed': len(commands),
                'successful_commands': successful_commands,
                'failed_commands': failed_commands,
                'results': results,
                'message': f'{len(successful_commands)}/{len(results)} comandos ejecutados. Algunos fallaron.',
                'validated_online': validate_online
            }
    
    @staticmethod
    def test_connection(host: str, port: int, password: str) -> Dict:
        """
        Prueba la conexión RCON
        
        Returns:
            {
                'status': 'connected' | 'error',
                'latency': int,
                'error': str (opcional),
                'message': str
            }
        """
        return RCONTester.test_connection(host, port, password)
    
    @staticmethod
    def execute_command(host: str, port: int, password: str, command: str) -> Dict:
        """
        Ejecuta un comando RCON simple
        
        Returns:
            {
                'success': bool,
                'response': str,
                'error': str (opcional),
                'latency': int
            }
        """
        client = RCONClient(host, port, password)
        connect_response = client.connect()
        
        if not connect_response.success:
            return {
                'success': False,
                'response': '',
                'error': connect_response.error,
                'message': RCONTester._translate_error(connect_response.error)
            }
        
        response = client.execute(command)
        client.disconnect()
        
        return {
            'success': response.success,
            'response': response.response or '',
            'error': response.error,
            'latency': response.latency
        }
