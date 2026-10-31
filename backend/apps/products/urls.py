"""
Product URLs.
"""
from django.urls import path
from . import views

app_name = 'products'

urlpatterns = [
    # Product Categories
    path(
        'stores/<uuid:store_id>/categories/',
        views.category_list,
        name='category-list'
    ),
    path(
        'stores/<uuid:store_id>/categories/create/',
        views.category_create,
        name='category-create'
    ),
    path(
        'categories/<uuid:category_id>/',
        views.category_detail,
        name='category-detail'
    ),
    
    # Public categories
    path(
        'public/stores/<slug:store_slug>/categories/',
        views.public_categories,
        name='public-categories'
    ),
    
    # Product CRUD (dentro de una tienda)
    path(
        'stores/<uuid:store_id>/products/',
        views.product_list_create,
        name='product-list-create'
    ),
    path(
        'products/<uuid:product_id>/duplicate/',
        views.product_duplicate,
        name='product-duplicate'
    ),
    path(
        'products/<uuid:product_id>/',
        views.product_detail,
        name='product-detail'
    ),
    
    # Product commands
    path(
        'products/<uuid:product_id>/commands/',
        views.product_commands,
        name='product-commands'
    ),
    path(
        'products/commands/<uuid:command_id>/',
        views.product_command_detail,
        name='product-command-detail'
    ),
    
    # Bulk operations
    path(
        'stores/<uuid:store_id>/products/reorder/',
        views.bulk_update_order,
        name='product-bulk-reorder'
    ),
    
    # Public endpoints
    path(
        'public/stores/<slug:store_slug>/products/',
        views.public_products,
        name='public-products'
    ),
    
    # Product gallery
    path(
        'products/<uuid:product_id>/gallery/',
        views.product_gallery,
        name='product-gallery'
    ),
    path(
        'products/gallery/<uuid:image_id>/',
        views.product_gallery_image,
        name='product-gallery-image'
    ),
    
    # Public product list (query params) - must be at the end
    path(
        'products/',
        views.public_product_list,
        name='public-product-list'
    ),
    path(
        'categories/',
        views.public_category_list,
        name='public-category-list'
    ),
]
