#!/usr/bin/env python3
"""
Generate Notion-ready test cases from Strapi schema files - Enhanced Version
Includes custom controller/policy detection and better naming
"""
import argparse
import json
import os
import glob
from pathlib import Path
from typing import Dict, List, Any

STRING_LIKE_TYPES = {'string', 'text', 'richtext', 'email', 'password', 'uid'}
NUMERIC_TYPES = {'integer', 'biginteger', 'float', 'decimal'}

class TestCaseGenerator:
    def __init__(self, schema_root: str = "."):
        self.schema_root = schema_root
        self.testcases = []
        self.content_types = {}
        self.components = {}
        self.ct_display_names = {}  # Map slug -> display name
        self.custom_controllers = {}
        self.custom_policies = {}

    def load_all_schemas(self):
        """Load all schema.json files from {schema_root}/src/api"""
        pattern = os.path.join(self.schema_root, "src/api/*/content-types/*/schema.json")
        schema_files = glob.glob(pattern)

        for filepath in sorted(schema_files):
            try:
                with open(filepath, 'r') as f:
                    schema = json.load(f)
                    # Extract content-type name from path (.../src/api/<ct_name>/content-types/...)
                    parts = os.path.normpath(filepath).split(os.sep)
                    ct_name = parts[parts.index("api") + 1]  # e.g., 'job', 'product'
                    self.content_types[ct_name] = schema
                    # Store display name
                    display_name = schema.get('info', {}).get('displayName', ct_name)
                    self.ct_display_names[ct_name] = display_name
            except Exception as e:
                print(f"Error reading {filepath}: {e}")

    def load_components(self):
        """Load all component schemas"""
        pattern = os.path.join(self.schema_root, "src/components/**/*.json")
        component_files = glob.glob(pattern, recursive=True)
        for filepath in sorted(component_files):
            try:
                with open(filepath, 'r') as f:
                    comp = json.load(f)
                    comp_name = Path(filepath).stem
                    self.components[comp_name] = comp
            except Exception as e:
                print(f"Error reading component {filepath}: {e}")

    def detect_custom_logic(self):
        """Detect custom controllers and policies"""
        # Find all controllers
        controllers = glob.glob(os.path.join(self.schema_root, "src/api/*/controllers/*.js"))
        for ctrl_path in controllers:
            parts = os.path.normpath(ctrl_path).split(os.sep)
            ct_name = parts[parts.index("api") + 1]
            if ct_name not in self.custom_controllers:
                self.custom_controllers[ct_name] = []
            self.custom_controllers[ct_name].append(ctrl_path)

        # Find all policies
        policies = glob.glob(os.path.join(self.schema_root, "src/api/*/policies/*.js"))
        for policy_path in policies:
            parts = os.path.normpath(policy_path).split(os.sep)
            ct_name = parts[parts.index("api") + 1]
            if ct_name not in self.custom_policies:
                self.custom_policies[ct_name] = []
            self.custom_policies[ct_name].append(policy_path)

    def add_testcase(self, title: str, module: str, test_type: str,
                     expected_result: str, steps: List[str],
                     test_data: str = "-", prerequisites: str = ""):
        """Add a test case to the list"""
        tc_id = f"TC-{len(self.testcases) + 1:03d}"
        # Default automatable by type: Security needs human judgment
        automatable = "No" if test_type == "Security" else "Yes"
        testcase = {
            "tc_id": tc_id,
            "title": title,
            "module": module,
            "type": test_type,
            "automatable": automatable,
            "status_chrome": "Not started",
            "status_firefox": "Not started",
            "status_safari": "Not started",
            "expected_result": expected_result,
            "steps_to_reproduce": steps,
            "test_data": test_data,
            "prerequisites": prerequisites,
            "note": ""
        }
        self.testcases.append(testcase)

    def generate_for_content_type(self, ct_name: str, schema: Dict):
        """Generate test cases for a single content type"""
        display_name = self.ct_display_names.get(ct_name, ct_name)
        kind = schema.get('kind', 'collectionType')
        has_draft_publish = schema.get('options', {}).get('draftAndPublish', False)
        has_i18n = schema.get('pluginOptions', {}).get('i18n', {}).get('localized', False)
        attributes = schema.get('attributes', {})

        # 1. Test case for required fields (non-relation)
        required_fields = []
        for field_name, field_config in attributes.items():
            if field_config.get('required') and field_config.get('type') != 'relation':
                required_fields.append(field_name)
                title = f"Create {display_name} entry fails when {field_name} field is empty"
                steps = [
                    f"Navigate to {display_name} content type in Admin Panel",
                    "Click 'Create New Entry'",
                    f"Leave {field_name} field empty or blank",
                    "Click 'Save'"
                ]
                expected = f"Form shows validation error for {field_name} field and entry is not saved"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Validation",
                    expected_result=expected,
                    steps=steps,
                    test_data=f"{field_name}: (empty)",
                    prerequisites=f"User has access to create {display_name} entries"
                )

        # 2. Test case for unique fields
        unique_fields = []
        for field_name, field_config in attributes.items():
            if field_config.get('unique'):
                unique_fields.append(field_name)
                title = f"Create duplicate {display_name} entry with same {field_name} fails"
                steps = [
                    f"Navigate to {display_name} content type",
                    f"Create and save a new entry with unique {field_name} value",
                    "Click 'Create New Entry' again",
                    f"Enter the same value for {field_name}",
                    "Click 'Save'"
                ]
                expected = f"System shows unique constraint violation error for {field_name}"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Validation",
                    expected_result=expected,
                    steps=steps,
                    test_data=f"{field_name}: (duplicate value)",
                    prerequisites=f"At least one {display_name} entry exists with unique {field_name}"
                )

        # 2b. Test cases for field length/value/format constraints
        for field_name, field_config in attributes.items():
            field_type = field_config.get('type')

            if field_type in STRING_LIKE_TYPES:
                max_len = field_config.get('maxLength')
                min_len = field_config.get('minLength')
                if max_len:
                    title = f"Create {display_name} entry fails when {field_name} exceeds max length of {max_len}"
                    steps = [
                        f"Navigate to {display_name} content type in Admin Panel",
                        "Click 'Create New Entry'",
                        f"Enter a {field_name} value longer than {max_len} characters",
                        "Click 'Save'"
                    ]
                    expected = f"Form shows validation error for {field_name} exceeding max length of {max_len}"
                    self.add_testcase(
                        title=title,
                        module=display_name,
                        test_type="Validation",
                        expected_result=expected,
                        steps=steps,
                        test_data=f"{field_name}: ({max_len + 1}+ characters)",
                        prerequisites=f"User has access to create {display_name} entries"
                    )
                if min_len:
                    title = f"Create {display_name} entry fails when {field_name} is shorter than min length of {min_len}"
                    steps = [
                        f"Navigate to {display_name} content type in Admin Panel",
                        "Click 'Create New Entry'",
                        f"Enter a {field_name} value shorter than {min_len} characters",
                        "Click 'Save'"
                    ]
                    expected = f"Form shows validation error for {field_name} below min length of {min_len}"
                    self.add_testcase(
                        title=title,
                        module=display_name,
                        test_type="Validation",
                        expected_result=expected,
                        steps=steps,
                        test_data=f"{field_name}: (fewer than {min_len} characters)",
                        prerequisites=f"User has access to create {display_name} entries"
                    )

            if field_type in NUMERIC_TYPES:
                min_val = field_config.get('min')
                max_val = field_config.get('max')
                if min_val is not None:
                    title = f"Create {display_name} entry fails when {field_name} is below minimum of {min_val}"
                    steps = [
                        f"Navigate to {display_name} content type in Admin Panel",
                        "Click 'Create New Entry'",
                        f"Enter a {field_name} value less than {min_val}",
                        "Click 'Save'"
                    ]
                    expected = f"Form shows validation error for {field_name} below minimum of {min_val}"
                    self.add_testcase(
                        title=title,
                        module=display_name,
                        test_type="Validation",
                        expected_result=expected,
                        steps=steps,
                        test_data=f"{field_name}: (< {min_val})",
                        prerequisites=f"User has access to create {display_name} entries"
                    )
                if max_val is not None:
                    title = f"Create {display_name} entry fails when {field_name} exceeds maximum of {max_val}"
                    steps = [
                        f"Navigate to {display_name} content type in Admin Panel",
                        "Click 'Create New Entry'",
                        f"Enter a {field_name} value greater than {max_val}",
                        "Click 'Save'"
                    ]
                    expected = f"Form shows validation error for {field_name} exceeding maximum of {max_val}"
                    self.add_testcase(
                        title=title,
                        module=display_name,
                        test_type="Validation",
                        expected_result=expected,
                        steps=steps,
                        test_data=f"{field_name}: (> {max_val})",
                        prerequisites=f"User has access to create {display_name} entries"
                    )

            regex = field_config.get('regex')
            if regex:
                title = f"Create {display_name} entry fails when {field_name} does not match required format"
                steps = [
                    f"Navigate to {display_name} content type in Admin Panel",
                    "Click 'Create New Entry'",
                    f"Enter a {field_name} value that does not match pattern {regex}",
                    "Click 'Save'"
                ]
                expected = f"Form shows validation error for {field_name} not matching the required format"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Validation",
                    expected_result=expected,
                    steps=steps,
                    test_data=f"{field_name}: (value not matching {regex})",
                    prerequisites=f"User has access to create {display_name} entries"
                )

        # 3. Test cases for relations
        relation_fields = []
        for field_name, field_config in attributes.items():
            if field_config.get('type') == 'relation':
                relation_fields.append(field_name)
                relation_type = field_config.get('relation', '')
                target = field_config.get('target', '')
                target_ct = target.split('::')[-1].split('.')[0] if target else 'related'
                target_display = self.ct_display_names.get(target_ct, target_ct)

                title = f"Link {field_name} relation in {display_name} entry"
                steps = [
                    f"Navigate to {display_name} content type",
                    "Create or edit an entry",
                    f"Locate {field_name} field",
                    f"Select a {target_display} entry to link",
                    "Click 'Save'"
                ]
                expected = f"Relation {field_name} is successfully linked and visible in {display_name} entry details"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Functionality",
                    expected_result=expected,
                    steps=steps,
                    test_data=f"relation: {field_name} -> {target_ct} ({relation_type})",
                    prerequisites=f"At least one {target_display} entry exists"
                )

        # 3b. Test cases for media (file/image) fields
        for field_name, field_config in attributes.items():
            if field_config.get('type') != 'media':
                continue

            title = f"Upload valid file to {field_name} field in {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                "Create or edit an entry",
                f"Locate {field_name} media field",
                "Upload a file of an allowed type and size",
                "Click 'Save'"
            ]
            expected = f"File uploads successfully and is displayed in the {field_name} field"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data=f"{field_name}: (valid file)",
                prerequisites=f"User is editing a {display_name} entry"
            )

            title = f"Upload fails when {field_name} file type is not allowed"
            steps = [
                f"Navigate to {display_name} content type",
                "Create or edit an entry",
                f"Locate {field_name} media field",
                "Attempt to upload a file of a disallowed type",
                "Click 'Save'"
            ]
            expected = f"Upload is rejected with a validation error for unsupported file type on {field_name}"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Validation",
                expected_result=expected,
                steps=steps,
                test_data=f"{field_name}: (disallowed file type)",
                prerequisites=f"User is editing a {display_name} entry"
            )

            title = f"Remove {field_name} media from {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                f"Open an entry with a {field_name} file already uploaded",
                f"Remove the {field_name} file",
                "Click 'Save'"
            ]
            expected = f"{field_name} is removed and {display_name} entry is saved successfully"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"{display_name} entry has a {field_name} file uploaded"
            )

        # 3c. Test cases for enumeration fields
        for field_name, field_config in attributes.items():
            if field_config.get('type') != 'enumeration':
                continue
            enum_values = field_config.get('enum', [])
            values_str = ', '.join(str(v) for v in enum_values) if enum_values else "each available option"

            title = f"Select each valid {field_name} value in {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                "Create or edit an entry",
                f"Open the {field_name} dropdown and select each available option in turn",
                "Click 'Save' after each selection"
            ]
            expected = f"Entry saves successfully for every valid {field_name} option: {values_str}"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data=f"{field_name}: {values_str}",
                prerequisites=f"User is editing a {display_name} entry"
            )

            title = f"Reject invalid {field_name} enum value via API"
            steps = [
                f"Send a POST or PUT request to the {display_name} API endpoint",
                f"Set {field_name} to a value outside the allowed set ({values_str})",
                "Observe the API response"
            ]
            expected = f"API returns a 400 validation error rejecting the invalid {field_name} value"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Validation",
                expected_result=expected,
                steps=steps,
                test_data=f"{field_name}: (value not in [{values_str}])",
                prerequisites="Valid auth token with create/update permission for this content type"
            )

        # 4. Test cases for draftAndPublish
        if has_draft_publish:
            # Publish test
            title = f"Publish {display_name} entry from draft to published"
            steps = [
                f"Navigate to {display_name} content type",
                "Create or edit an entry with valid data",
                "Click 'Save' to save as draft",
                "Click 'Publish' button",
                "Confirm publication in dialog"
            ]
            expected = f"{display_name} entry status changes to 'Published' and is accessible via API"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"User has permission to publish {display_name} entries"
            )

            # Unpublish test
            title = f"Unpublish {display_name} entry from published to draft"
            steps = [
                f"Navigate to {display_name} content type",
                "Open a published entry",
                "Click 'Unpublish' button",
                "Confirm unpublication in dialog"
            ]
            expected = f"{display_name} entry status changes to 'Draft' and is no longer accessible via API"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"A published {display_name} entry exists"
            )

        # 5. Test cases for components (repeatable)
        repeatable_components = []
        for field_name, field_config in attributes.items():
            if field_config.get('type') == 'component':
                component_name = field_config.get('component', '')
                is_repeatable = field_config.get('repeatable', False)
                min_items = field_config.get('min')
                max_items = field_config.get('max')

                if is_repeatable:
                    repeatable_components.append({
                        'name': field_name,
                        'component': component_name,
                        'min': min_items,
                        'max': max_items,
                        'required': field_config.get('required', False)
                    })

                    # Add component
                    title = f"Add {field_name} component to {display_name} entry"
                    steps = [
                        f"Navigate to {display_name} content type",
                        "Create or edit an entry",
                        f"Locate {field_name} section (repeatable component)",
                        "Click 'Add' button to add new component",
                        "Fill in required component fields",
                        "Click 'Save'"
                    ]
                    expected = f"Component is added successfully and appears in {field_name} list"
                    self.add_testcase(
                        title=title,
                        module=display_name,
                        test_type="Functionality",
                        expected_result=expected,
                        steps=steps,
                        test_data=f"component: {component_name}",
                        prerequisites=f"User is editing a {display_name} entry"
                    )

                    # Reorder components (only if min 2+)
                    if not min_items or min_items < 2:
                        title = f"Reorder {field_name} components in {display_name} entry"
                        steps = [
                            f"Navigate to {display_name} content type",
                            f"Open an entry with multiple {field_name} components",
                            "Drag and drop component rows to reorder them",
                            "Click 'Save'"
                        ]
                        expected = f"Components are reordered and new order is persisted in {display_name}"
                        self.add_testcase(
                            title=title,
                            module=display_name,
                            test_type="Functionality",
                            expected_result=expected,
                            steps=steps,
                            test_data="-",
                            prerequisites=f"{display_name} entry has at least 2 {field_name} components"
                        )

                    # Remove component
                    title = f"Remove {field_name} component from {display_name} entry"
                    steps = [
                        f"Navigate to {display_name} content type",
                        f"Open an entry with {field_name} components",
                        "Click delete/remove button on a component row",
                        "Click 'Save'"
                    ]
                    expected = f"Component is removed and {display_name} entry is saved successfully"
                    self.add_testcase(
                        title=title,
                        module=display_name,
                        test_type="Functionality",
                        expected_result=expected,
                        steps=steps,
                        test_data="-",
                        prerequisites=f"{display_name} entry has at least one {field_name} component"
                    )

                    # Minimum items validation
                    if min_items and min_items > 0:
                        title = f"Validate minimum {min_items} {field_name} components required in {display_name}"
                        steps = [
                            f"Navigate to {display_name} content type",
                            "Create a new entry",
                            f"Add less than {min_items} {field_name} components",
                            "Click 'Save'"
                        ]
                        expected = f"Validation error shows that at least {min_items} {field_name} component(s) are required"
                        self.add_testcase(
                            title=title,
                            module=display_name,
                            test_type="Validation",
                            expected_result=expected,
                            steps=steps,
                            test_data=f"component count: {min_items - 1}",
                            prerequisites=f"User is creating a {display_name} entry"
                        )

                    # Maximum items validation
                    if max_items:
                        title = f"Validate maximum {max_items} {field_name} components allowed in {display_name}"
                        steps = [
                            f"Navigate to {display_name} content type",
                            "Create or edit an entry",
                            f"Try to add more than {max_items} {field_name} components",
                            "Attempt to click 'Add' button when at limit"
                        ]
                        expected = f"'Add' button is disabled or validation error shows max {max_items} components allowed"
                        self.add_testcase(
                            title=title,
                            module=display_name,
                            test_type="Validation",
                            expected_result=expected,
                            steps=steps,
                            test_data=f"component count: {max_items + 1}",
                            prerequisites=f"{display_name} entry has {max_items} {field_name} components"
                        )

        # 5b. Test cases for dynamic zones
        for field_name, field_config in attributes.items():
            if field_config.get('type') != 'dynamiczone':
                continue
            allowed_components = field_config.get('components', [])
            min_items = field_config.get('min')
            max_items = field_config.get('max')
            components_str = ', '.join(allowed_components) if allowed_components else "-"

            title = f"Add component to {field_name} dynamic zone in {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                "Create or edit an entry",
                f"Locate {field_name} dynamic zone",
                "Click 'Add a component to the zone' and select a component type",
                "Fill in required component fields",
                "Click 'Save'"
            ]
            expected = f"Selected component is added to {field_name} zone and appears in the correct position"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data=f"available components: {components_str}",
                prerequisites=f"User is editing a {display_name} entry"
            )

            if not min_items or min_items < 2:
                title = f"Reorder components within {field_name} dynamic zone in {display_name} entry"
                steps = [
                    f"Navigate to {display_name} content type",
                    f"Open an entry with multiple components in {field_name} zone",
                    "Drag and drop zone components to reorder them",
                    "Click 'Save'"
                ]
                expected = f"Components are reordered and new order is persisted in {display_name}"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Functionality",
                    expected_result=expected,
                    steps=steps,
                    test_data="-",
                    prerequisites=f"{display_name} entry has at least 2 components in {field_name} zone"
                )

            title = f"Remove component from {field_name} dynamic zone in {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                f"Open an entry with components in {field_name} zone",
                "Click delete/remove button on a zone component",
                "Click 'Save'"
            ]
            expected = f"Component is removed from {field_name} zone and {display_name} entry is saved successfully"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"{display_name} entry has at least one component in {field_name} zone"
            )

            if min_items and min_items > 0:
                title = f"Validate minimum {min_items} components required in {field_name} dynamic zone"
                steps = [
                    f"Navigate to {display_name} content type",
                    "Create a new entry",
                    f"Add fewer than {min_items} components to {field_name} zone",
                    "Click 'Save'"
                ]
                expected = f"Validation error shows that at least {min_items} component(s) are required in {field_name}"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Validation",
                    expected_result=expected,
                    steps=steps,
                    test_data=f"component count: {min_items - 1}",
                    prerequisites=f"User is creating a {display_name} entry"
                )

            if max_items:
                title = f"Validate maximum {max_items} components allowed in {field_name} dynamic zone"
                steps = [
                    f"Navigate to {display_name} content type",
                    "Create or edit an entry",
                    f"Try to add more than {max_items} components to {field_name} zone",
                    "Attempt to click 'Add a component to the zone' when at limit"
                ]
                expected = f"'Add' action is disabled or validation error shows max {max_items} components allowed in {field_name}"
                self.add_testcase(
                    title=title,
                    module=display_name,
                    test_type="Validation",
                    expected_result=expected,
                    steps=steps,
                    test_data=f"component count: {max_items + 1}",
                    prerequisites=f"{display_name} entry has {max_items} components in {field_name} zone"
                )

        # 5c. Test cases for localization (i18n)
        if has_i18n:
            title = f"Create {display_name} entry in a non-default locale"
            steps = [
                f"Navigate to {display_name} content type",
                "Switch the locale selector to a non-default locale",
                "Fill in required fields with valid data",
                "Click 'Save'"
            ]
            expected = "Entry is created for the selected locale, independent of the default locale entry"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="locale: (non-default)",
                prerequisites="At least one non-default locale is configured"
            )

            title = f"Editing {display_name} entry in one locale does not affect other locales"
            steps = [
                f"Navigate to {display_name} content type",
                "Open an entry that exists in multiple locales",
                "Modify a field value in one locale and save",
                "Switch to a different locale for the same entry"
            ]
            expected = "The field change is isolated to the edited locale; other locales retain their own values"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"{display_name} entry exists in at least two locales"
            )

        # 6. Generic CRUD test cases
        # Strapi singleType content types (e.g. "About Page") have exactly one
        # entry, edited in place — there is no list view and no delete
        # affordance the way collectionType has. Branch accordingly.
        if kind == 'singleType':
            # Edit entry (replaces Create — a singleType entry always exists)
            title = f"Edit {display_name} entry and save changes"
            steps = [
                f"Navigate to {display_name} content type in Admin Panel",
                "Modify one or more fields with valid data",
                "Click 'Save'"
            ]
            expected = f"Changes are saved and reflected in the {display_name} entry"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="one or more fields: valid data",
                prerequisites=f"User has permission to edit {display_name}"
            )

            # View entry (still applicable — singleType is viewable/editable)
            title = f"View {display_name} entry details"
            steps = [
                f"Navigate to {display_name} content type",
                "Verify all fields are displayed with correct values"
            ]
            expected = f"{display_name} entry page loads and all fields are visible and correct"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"{display_name} entry has been configured"
            )
            # No "Delete entry" TC: singleType has no list/delete affordance.
            # Publish/Unpublish already covered above in section 4 when
            # has_draft_publish is true — not duplicated here.
        else:
            # Create entry
            title = f"Create new {display_name} entry with valid data"
            steps = [
                f"Navigate to {display_name} content type",
                "Click 'Create New Entry'",
                "Fill in all required fields with valid data",
                "Click 'Save'"
            ]
            expected = f"Entry is created successfully and appears in {display_name} list view"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="all required fields: valid data",
                prerequisites=f"User has permission to create {display_name} entries"
            )

            # Read/View entry
            title = f"View {display_name} entry details"
            steps = [
                f"Navigate to {display_name} content type",
                "Click on an entry in the list to view details",
                "Verify all fields are displayed with correct values"
            ]
            expected = f"{display_name} entry details page loads and all fields are visible and correct"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"At least one {display_name} entry exists"
            )

            # Update entry
            title = f"Update {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                "Open an existing entry",
                "Modify one or more fields with new valid data",
                "Click 'Save'"
            ]
            expected = f"Changes are saved and reflected in the {display_name} entry"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="any field: modified value",
                prerequisites=f"At least one {display_name} entry exists"
            )

            # Delete entry
            title = f"Delete {display_name} entry"
            steps = [
                f"Navigate to {display_name} content type",
                "Select an entry from the list",
                "Click delete button",
                "Confirm deletion in dialog"
            ]
            expected = f"Entry is deleted and no longer appears in the {display_name} list"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"At least one {display_name} entry exists"
            )

        # 7. Test cases for custom controllers/policies
        if ct_name in self.custom_controllers:
            title = f"Verify custom controller logic for {display_name}"
            steps = [
                f"Navigate to {display_name} content type",
                "Perform an action that triggers custom controller",
                "Verify response and side effects are as expected"
            ]
            expected = "Custom controller executes correctly without errors"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Functionality",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites=f"User has appropriate permissions for {display_name}"
            )

        if ct_name in self.custom_policies:
            title = f"Verify custom policy access control for {display_name}"
            steps = [
                f"Attempt to access {display_name} without required permissions",
                "Verify request is denied",
                f"Access {display_name} with required permissions",
                "Verify request is allowed"
            ]
            expected = "Custom policy correctly enforces access control"
            self.add_testcase(
                title=title,
                module=display_name,
                test_type="Security",
                expected_result=expected,
                steps=steps,
                test_data="-",
                prerequisites="Multiple user roles with different permissions exist"
            )

    def generate_api_testcases(self, ct_name: str, schema: Dict):
        """Generate REST API permission test cases for a content type.

        Complements the Admin-Panel UI test cases from
        generate_for_content_type() with the API-level checks CLAUDE.md's
        Test Coverage Checklist calls for (public/401/authenticated access),
        which UI-click test cases never exercise.
        """
        display_name = self.ct_display_names.get(ct_name, ct_name)
        plural = schema.get('info', {}).get('pluralName', ct_name)
        endpoint = f"/api/{plural}"

        title = f"GET {endpoint} without auth token respects Public role permission"
        steps = [
            f"Send a GET request to {endpoint} with no Authorization header",
            "Observe the response status and body"
        ]
        expected = (
            f"If the Public role has 'find' permission enabled for {display_name}, "
            "response is 200 with entries; otherwise response is 403 Forbidden — "
            "verify against the configured Public role permissions"
        )
        self.add_testcase(
            title=title,
            module=display_name,
            test_type="Security",
            expected_result=expected,
            steps=steps,
            test_data="-",
            prerequisites="Public role permissions for this content type are known/configured"
        )

        title = f"POST {endpoint} without auth token is rejected"
        steps = [
            f"Send a POST request to {endpoint} with no Authorization header and a valid payload",
            "Observe the response status"
        ]
        expected = "Response is 401 Unauthorized or 403 Forbidden — unauthenticated create is not permitted"
        self.add_testcase(
            title=title,
            module=display_name,
            test_type="Security",
            expected_result=expected,
            steps=steps,
            test_data="-",
            prerequisites="-"
        )

        title = f"GET {endpoint} with valid authenticated token returns entries"
        steps = [
            "Obtain a valid JWT for an authenticated user/role",
            f"Send a GET request to {endpoint} with an 'Authorization: Bearer <token>' header",
            "Observe the response"
        ]
        expected = f"Response is 200 with the {display_name} entries the authenticated role is permitted to see"
        self.add_testcase(
            title=title,
            module=display_name,
            test_type="Functionality",
            expected_result=expected,
            steps=steps,
            test_data="-",
            prerequisites="Authenticated test user/role exists with appropriate permissions"
        )

    def generate_all(self):
        """Generate all test cases"""
        self.load_all_schemas()
        self.load_components()
        self.detect_custom_logic()

        print(f"Found {len(self.content_types)} content types")
        print(f"Found {len(self.components)} components")
        print(f"Found {len(self.custom_controllers)} content types with custom controllers")
        print(f"Found {len(self.custom_policies)} content types with custom policies")

        for ct_name in sorted(self.content_types.keys()):
            schema = self.content_types[ct_name]
            display_name = self.ct_display_names.get(ct_name, ct_name)
            print(f"Generating test cases for {display_name}...")
            self.generate_for_content_type(ct_name, schema)
            self.generate_api_testcases(ct_name, schema)

        return self.testcases

    def check_staleness(self, filename: str):
        """Warn (non-blocking) if an existing output file is missing fields
        this script now produces — signals it was generated by an older
        version and should be regenerated rather than trusted as-is."""
        if not os.path.exists(filename) or not self.testcases:
            return
        try:
            with open(filename, 'r') as f:
                existing = json.load(f)
        except Exception:
            return
        if not existing:
            return
        existing_keys = set(existing[0].keys())
        current_keys = set(self.testcases[0].keys())
        missing = current_keys - existing_keys
        if missing:
            print(f"\n⚠️  Existing {filename} is missing fields this script now "
                  f"produces: {sorted(missing)}. Recommend regenerating "
                  f"(this run will overwrite it).")

    def save_to_file(self, filename: str):
        """Save test cases to JSON file"""
        self.check_staleness(filename)
        out_dir = os.path.dirname(filename)
        if out_dir:
            os.makedirs(out_dir, exist_ok=True)
        with open(filename, 'w') as f:
            json.dump(self.testcases, f, indent=2)
        print(f"\nTest cases saved to {os.path.abspath(filename)}")
        print(f"Total test cases: {len(self.testcases)}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate Notion-ready test cases from Strapi schema files."
    )
    parser.add_argument(
        "--schema-root", default=".",
        help="Root directory containing src/api and src/components (default: cwd)"
    )
    parser.add_argument(
        "--out", default="../testcases.json",
        help="Output JSON path (default: ../testcases.json, i.e. the "
             "repo-root canonical file, one level up from this script's own "
             "directory; parent dirs are created if missing)"
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    generator = TestCaseGenerator(schema_root=args.schema_root)
    testcases = generator.generate_all()
    generator.save_to_file(args.out)

    # Print summary
    by_module = {}
    by_type = {}
    for tc in testcases:
        module = tc['module']
        test_type = tc['type']
        by_module[module] = by_module.get(module, 0) + 1
        by_type[test_type] = by_type.get(test_type, 0) + 1

    print("\n" + "="*70)
    print("TEST CASE GENERATION SUMMARY")
    print("="*70)
    print(f"Total Test Cases Generated: {len(testcases)}")
    print(f"Content Types Covered: {len(by_module)}")
    print(f"\nTest Cases by Type:")
    for test_type in sorted(by_type.keys()):
        print(f"  {test_type:15} : {by_type[test_type]:3} test cases")
    print(f"\nTest Cases by Module:")
    for module in sorted(by_module.keys()):
        print(f"  {module:30} : {by_module[module]:3} test cases")
    print("="*70)
