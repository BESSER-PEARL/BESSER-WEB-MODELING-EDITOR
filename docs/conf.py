"""Sphinx configuration for BESSER WME Standalone documentation."""
from __future__ import annotations

import os
import sys
from datetime import datetime

# -- Path setup --------------------------------------------------------------

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".", ".."))

sys.path.insert(0, REPO_ROOT)

# -- Project information -----------------------------------------------------

project = "BESSER Web Modeling Editor"
copyright = f"{datetime.now():%Y}, BESSER"
author = "BESSER"

# The short X.Y version and the full version, including alpha/beta/rc tags
release = "1.0.0"
version = release

# -- General configuration ---------------------------------------------------

extensions = [
    "sphinx.ext.autodoc",
    "sphinx.ext.napoleon",
    "sphinx.ext.intersphinx",
    "sphinx.ext.todo",
    "sphinx.ext.viewcode",
]

intersphinx_mapping = {
    "python": ("https://docs.python.org/3", {}),
    "node": ("https://nodejs.org/api", {}),
}

# Templates path
templates_path = ["_templates"]

# List of patterns to ignore when looking for source files.
exclude_patterns: list[str] = [
    "_build",
    "Thumbs.db",
    ".DS_Store",
]

# -- Options for HTML output -------------------------------------------------

html_theme = "sphinx_rtd_theme"
html_static_path = ["_static"]

# If true, `todo` and `todoList` produce output, else they produce nothing.
todo_include_todos = True

# -- Options for Napoleon ----------------------------------------------------

napoleon_google_docstring = True
napoleon_numpy_docstring = True

# -- Options for source files ------------------------------------------------

source_suffix = {
    ".rst": "restructuredtext",
}

master_doc = "index"

# -- Project-specific settings ----------------------------------------------

primary_domain = "js"

# Provide commonly used replacements
rst_epilog = "\n.. |project| replace:: BESSER Web Modeling Editor\n"
