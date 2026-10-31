"""
Custom exception handlers for consistent API error responses.
"""
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses.
    
    Returns:
        {
            "error": {
                "code": "error_code",
                "message": "Human readable message",
                "details": {...}  # Optional
            }
        }
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Standardize the error response format
        error_data = {
            'error': {
                'code': get_error_code(exc),
                'message': get_error_message(response.data),
                'status_code': response.status_code,
            }
        }
        
        # Add details if available
        if isinstance(response.data, dict) and len(response.data) > 1:
            error_data['error']['details'] = response.data
        
        response.data = error_data
        
        # Log errors
        logger.error(
            f"API Error: {error_data['error']['code']} - {error_data['error']['message']}",
            extra={'context': context, 'exception': str(exc)}
        )
        
        return response
    
    # Handle Django validation errors
    if isinstance(exc, DjangoValidationError):
        return Response(
            {
                'error': {
                    'code': 'validation_error',
                    'message': 'Validation failed',
                    'details': exc.message_dict if hasattr(exc, 'message_dict') else {'detail': exc.messages},
                    'status_code': status.HTTP_400_BAD_REQUEST,
                }
            },
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Handle 404 errors
    if isinstance(exc, Http404):
        return Response(
            {
                'error': {
                    'code': 'not_found',
                    'message': 'Resource not found',
                    'status_code': status.HTTP_404_NOT_FOUND,
                }
            },
            status=status.HTTP_404_NOT_FOUND
        )
    
    # Handle unexpected errors
    logger.exception(f"Unhandled exception: {exc}")
    return Response(
        {
            'error': {
                'code': 'internal_server_error',
                'message': 'An unexpected error occurred',
                'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR,
            }
        },
        status=status.HTTP_500_INTERNAL_SERVER_ERROR
    )


def get_error_code(exc):
    """Extract error code from exception."""
    return getattr(exc, 'default_code', exc.__class__.__name__.lower())


def get_error_message(data):
    """Extract human-readable message from error data."""
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        if 'message' in data:
            return str(data['message'])
        # Return first error message found
        for value in data.values():
            if isinstance(value, (str, list)):
                return str(value[0]) if isinstance(value, list) else str(value)
    return str(data)
