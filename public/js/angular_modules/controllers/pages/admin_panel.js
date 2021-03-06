angular.element(document).ready(() => {
    init_materialize();
});

const app = angular.module('global_app', ['ngSanitize', 'ngAnimate', 'loaderM', 'timersM', 'modalsM',
    'globalDataM', 'plansM', 'topicsM', 'aceM', 'adminUsersM', 'adminPlansM', 'adminTopicsM', 'adminTasksM', 'globalM'])

    .controller('body_controller', ($scope, $http, $window, $interval, $timeout, $location, $compile, preloader, dark_area,
                                    timers_manager_s, modals_s, plans_s, topics_s, users_roles_s, admin_users_s, admin_plans_s,
                                    admin_topics_s, admin_tasks_s) => {
        ng_init_sidenav(dark_area);
        modals_s.init($scope, preloader, dark_area);
        timers_manager_s.init($scope, $http, $timeout, preloader);
        users_roles_s.init($scope);
        plans_s.init($scope, $http, timers_manager_s, preloader);
        topics_s.init($scope, $http, timers_manager_s, preloader);
        admin_users_s.init($scope, $http, preloader);
        admin_plans_s.init($scope, $http, timers_manager_s, modals_s, preloader);
        admin_topics_s.init($scope, $http, timers_manager_s, modals_s, preloader);
        admin_tasks_s.init($scope, $http, timers_manager_s, modals_s, preloader);

        $scope.utils = {
            keys : Object.keys,
            values : Object.values
        };

        $scope.get_user_details = (username) => {
            admin_users_s.get_user_details(username, (data) => {
                $('#user_role').val(data.role);
                $('select').formSelect();
            })
        };

        $scope.back_to_parent_category = () => {
            window.location.assign(".");
        };

        /**
         * @override the one declared in plans_s

         * @returns Promise
         */
        $scope.get_plan_details = (plan_name) => {
            return plans_s.get_plan_details(plan_name, (data) => {
                $interval(() => {
                    $scope.original_plan_name = data.name;
                    $timeout(() => {
                        M.textareaAutoResize($('#description'));
                        M.updateTextFields();
                    }, 100);
                }, 10, 50);
            });
        };

        $scope.init_plans_page = () => {

            // Function Definitions

            /**
             * @param topics_list - Topics list
             * @param topic_name - Target topic
             * @returns If found - topic_id, Else undefined.
             */
            function get_topic_id_by_name(topics_list, topic_name) {
                let selected_topic = topics_list.find(topic => topic.name === topic_name);
                return selected_topic ? selected_topic._id : undefined;
            }

            /**
             * @param tasks_list - Tasks list
             * @param target_task - Target task id
             * @returns If found - task data, Else undefined.
             */
            function get_task_data_by_id(tasks_list, target_task) {
                return tasks_list.find(task => task._id === target_task);
            }

            /**
             * @description Restore currently plan tasks route
             */
            function restore_currently_plan_tasks_route() {
                let plan_route = $scope.plan_data.route;
                let ordered_topics = [];
                plan_route.forEach(task_id => {
                    $timeout(() => {
                        $("[data-task-id='" + task_id + "']").trigger("click");
                    }, 300);
                    // Reorder topics by currently inner plan order
                    let current_task_data = get_task_data_by_id($scope.tasks_list, task_id);
                    if (!ordered_topics.includes(current_task_data.topic_id)) {
                        ordered_topics.push(current_task_data.topic_id);
                        let current_topic = $scope.topics_data_with_tasks_list[current_task_data.topic_id];
                        current_topic.topic_order = ordered_topics.length;
                        $scope.selected_topics[current_topic.name] = true;
                    }
                });
            }

            /**
             *
             */
            function prepare_topics_reordering() {
                const route_editing = document.getElementById("route_editing");
                const dragonDrop = new DragonDrop(route_editing, {
                    handle: '.dragon-handle',
                    announcement: {
                        //grabbed: el => `${el.querySelector('span').innerText} grabbed`,
                        dropped: (el) => {
                            let items = $("#route_editing>div");
                            const current_element_pos = items.index(el);
                            const current_topic_name = items[current_element_pos].querySelector("[data-topic-name]").getAttribute("data-topic-name");
                            /*for (let i = 0; i < current_element_pos; i++) {
                                let dependencies = items[i].querySelector("[data-topic-dependencies]").getAttribute("data-topic-dependencies");
                                if (dependencies.includes(current_topic_name)) {
                                    items[current_element_pos].classList.add("invalid");
                                }
                            }*/
                            $timeout(() => {
                                $scope.plan_form["topic_checkbox_" + current_topic_name].$validate();
                            }, 100);
                        },
                        reorder: (el, items) => {
                            console.log("admin_panel.js::Reorder function");
                            return "Reorder - Not working";
                        },
                        cancel: 'Reranking cancelled.'
                    }
                });
            }

            /**
             *
             */
            function prepare_topics_map_by_id_variable() {
                let map_topics_by_id = {};
                let current_topic;
                for (let i = 0; i < $scope.topics_list.length; i++) {
                    current_topic = $scope.topics_list[i];
                    map_topics_by_id[current_topic._id] = current_topic;
                    map_topics_by_id[current_topic._id].related_tasks = [];
                }
                let current_task;
                for (let i = 0; i < $scope.tasks_list.length; i++) {
                    current_task = $scope.tasks_list[i];
                    map_topics_by_id[current_task.topic_id].related_tasks.push(current_task);
                }
                $scope.topics_data_with_tasks_list = map_topics_by_id;
            }

            /**
             *
             */
            $scope.check_for_topic_dependencies = () => {
                let new_dependencies = [];
                for (let topic_name in $scope.selected_topics) {
                    if ($scope.selected_topics.hasOwnProperty(topic_name) && $scope.selected_topics[topic_name]) {
                        let topic_id = get_topic_id_by_name($scope.topics_list, topic_name);
                        let topic = $scope.topics_data_with_tasks_list[topic_id];
                        topic.dependencies_topics.forEach(dependency => {
                            new_dependencies[dependency] ? new_dependencies[dependency].push(topic_name) : new_dependencies[dependency] = [topic_name];
                        });
                    }
                }
                $scope.all_dependencies_topics = new_dependencies;
            };


            // Custom operation pages initializations functions

            $scope.init_create_new_plan_page = () => {
                // Scope variables initializations
                $scope.plan_data = {};
                $scope.selected_topics = {};

                prepare_topics_reordering();

                let promises = [];
                promises.push($scope.get_all_topics());
                promises.push($scope.get_all_tasks());

                Promise.all(promises).then(() => {
                    $timeout(() => {
                        prepare_topics_map_by_id_variable();
                    }, 100);
                });
            };

            $scope.init_modify_plan_page = (plan_name) => {
                // Scope variables initializations
                $scope.selected_topics = {};

                prepare_topics_reordering();

                let promises = [];
                promises.push($scope.get_plan_details(plan_name));
                promises.push($scope.get_all_topics());
                promises.push($scope.get_all_tasks());

                Promise.all(promises).then(() => {
                    prepare_topics_map_by_id_variable();

                    // Restore currently plan tasks route
                    restore_currently_plan_tasks_route();
                });
            };
        };

        let prepare_data_for_chips = (data) => {
            let new_data = [];
            for (let i = 0; i < data.length; i++) {
                new_data.push({tag: data[i]});
            }
            return new_data;
        };

        let make_strict_chips_object = (id, data, options, forbidden_options, placeholder) => {
            let new_data = prepare_data_for_chips(data);

            options = options.filter((el) => !forbidden_options.includes(el) );

            let autocomplete_options = {};
            for (let i = 0; i < options.length; i++) {
                autocomplete_options[options[i]] = null;
            }

            $("#" + id).chips({
                data: new_data,
                placeholder: placeholder,
                secondaryPlaceholder: "+" + placeholder,
                autocompleteOptions: {
                    data: autocomplete_options,
                    limit: Infinity,
                    minlength: 0
                },
                onChipAdd: (event) => {
                    let all_chips = event[0].M_Chips.chipsData;
                    let added_chip_name = all_chips[all_chips.length - 1].tag;
                    let is_legal = options.includes(added_chip_name);
                    if (!is_legal) {
                        $("#" + id).chips("deleteChip", all_chips.length - 1);
                        alertify.error("This topic does not exist, please choose a legal topic from the list.");
                    }
                }
            });
        };

        let extract_chips_data = (chips_elem_id) => {
            let src_array = $('#' + chips_elem_id).chips('getData');
            let dst = [];
            for (let i = 0; i < src_array.length; i++) {
                dst.push(src_array[i].tag);
            }
            return dst;
        };

        let attach_extract_chips_data_to_specific_collection = (collection_name, function_name, chips_elem_id) => {
            $scope[collection_name][function_name] = () => {
                return extract_chips_data(chips_elem_id);
            }
        };

        $scope.init_topics_page = () => {

            let extract_topics_list_names = (topics_list) => {
                let topics_names_list = [];
                for (let i = 0; i < topics_list.length; i++) {
                    topics_names_list.push(topics_list[i].name);
                }
                return topics_names_list;
            };

            $scope.get_topic_details = (topic_name) => {
                admin_topics_s.get_topic_details(topic_name, (data) => {
                    attach_extract_chips_data_to_specific_collection("topic_data","get_dependencies_topics","dependencies_topics");

                    $interval(() => {
                        $scope.original_topic_name = data.name;
                        $timeout(() => {
                            M.textareaAutoResize($('#description'));
                            M.updateTextFields();
                        }, 10);
                    }, 10, 50);

                    $scope.get_all_topics().done(() => {
                        make_strict_chips_object("dependencies_topics", data.dependencies_topics, extract_topics_list_names($scope.topics_list) || [], [data.name],"Dependency Topic");
                    });
                });
            };

            $scope.init_create_new_topic_page = () => {
                $scope.topic_data = {};
                attach_extract_chips_data_to_specific_collection("topic_data","get_dependencies_topics","dependencies_topics");

                $scope.get_all_topics().done(() => {
                    make_strict_chips_object("dependencies_topics", [], extract_topics_list_names($scope.topics_list) || [], [],"Dependency Topic");
                });
            }
        };

        $scope.init_tasks_page = () => {
            $scope.initialize_code_section = function(editor) {
                $scope.current_ace_editor_initializing = editor;
                $("#customize_code_modal").modal('open');
            };

            $scope.submit_editor = () => {
                $scope.current_ace_editor_initializing.setTheme($scope.ace_theme);
                $scope.current_ace_editor_initializing.session.setMode($scope.ace_language);
                $scope.task_data.code_sections[$scope.task_data.code_sections.length - 1].theme = $scope.ace_theme;
                $scope.task_data.code_sections[$scope.task_data.code_sections.length - 1].language = $scope.ace_language;
            };

            $scope.restore_code_section = function(editor) {
                let current_data = $scope.task_data.code_sections[$scope.task_data.code_sections.length - 1];
                editor.setTheme(current_data.theme);
                editor.session.setMode(current_data.language);
            };

            let init_task_text_soft_answer_chips = (elem_id, data) => {
                data = data || [];
                $("#" + elem_id).chips({
                    data: prepare_data_for_chips(data),
                    placeholder: "Must Include",
                    secondaryPlaceholder: "+Must Include",
                    onChipAdd: (event) => {
                        let all_chips = event[0].M_Chips.chipsData;
                        let added_chip_name = all_chips[all_chips.length - 1].tag;
                        $scope.task_data.answer.push(added_chip_name)
                    },
                    onChipDelete: (event, chip) => {
                        let removed_chip_name = chip.childNodes[0].textContent;
                        $scope.task_data.answer = $scope.task_data.answer.filter((elem) => elem !== removed_chip_name);
                    }
                });
            };

            $scope.change_answer_type = () => {
                $scope.task_data.answer.splice(0);
                init_task_text_soft_answer_chips("task_text_soft_answer");
            };

            $scope.add_new_boolean_option = () => {
                let current_option_number = $scope.task_data.answer_options.length;
                let value = $scope.new_boolean_option;
                if (value && !$scope.task_data.answer_options.includes(value)) {
                    $scope.new_boolean_option = "";
                    $scope.task_data.answer_options[current_option_number] = value;
                    $("#task_answer_boolean_options").append(
                        $compile(
                            "<li class='row' id='task_answer_boolean_option_" + current_option_number + "'>\
                                <div class='col s6 m6 l4' ng-class='{\"green\": task_data.answer.includes(task_data.answer_options[" + current_option_number + "])}'>\
                                    {{task_data.answer_options[" + current_option_number + "]}}\
                                </div> \
                                <div class='col s2 m1'>\
                                    <a class=\"btn-small btn-floating waves-effect waves-light\"\
                                       ng-click='edit_list_item(task_data.answer_options, task_data.answer_options[" + current_option_number + "])'> \
                                        <i class=\"material-icons\">edit</i> \
                                    </a>\
                                </div>\
                                <div class='col s2 m1'>\
                                    <a class='btn-small btn-floating waves-effect waves-light'\
                                       ng-click='delete_input_row(\"task_answer_boolean_option_" + current_option_number + "\", task_data.answer_options, " + current_option_number + ");'>\
                                        <i class='material-icons'>delete</i>\
                                    </a>\
                                </div>\
                                <div class='col s2 m4 l6'>\
                                    <div style='display: inline-flex; vertical-align: middle;' ng-class=\"[ \
                                                        {'green-text': task_data.answer.includes(task_data.answer_options[" + current_option_number + "])},\
                                                        {'grey-text': !task_data.answer.includes(task_data.answer_options[" + current_option_number + "])}\
                                                    ]\"\
                                         ng-click='toggle_boolean_answer_selection(task_data.answer_options[" + current_option_number + "]);'>\
                                        <i class='material-icons'>done</i>\
                                    </div>\
                                </div>\
                            </li>"
                        )($scope)
                    )
                }
            };

            $scope.toggle_boolean_answer_selection = (selected_value) => {
                if ($scope.task_data.answer_type === 'BOOLEAN') {
                    $scope.task_data.answer = [selected_value];
                } else {
                    $scope.task_data.answer.includes(selected_value) ?
                        $scope.task_data.answer = $scope.task_data.answer.filter(item => item !== selected_value) :
                        $scope.task_data.answer.push(selected_value);
                }
            };

            $scope.add_input_row = (section_id, type, collection, is_restore) => {
                let element_id_prefix;
                let element_id_block_prefix;
                let next_element_id;
                let next_element_block_id;
                let next_element_number;
                if (!is_restore) {
                    next_element_number = collection.length;
                    collection[next_element_number] = {};
                } else {
                    next_element_number = collection.length - 1;
                }

                let section_element = $("#" + section_id);

                switch (type) {
                    case "code":
                        element_id_prefix = "code_section_";
                        element_id_block_prefix = element_id_prefix + "block_";
                        next_element_id = element_id_prefix + next_element_number;
                        next_element_block_id = element_id_block_prefix + next_element_number;
                        section_element.append(
                            $compile(
                                "<div id='" + next_element_block_id + "' class='row'>" +
                                "   <a style='z-index: 1; position: relative;' class='col s1 btn-small red waves-light'" +
                                "      ng-click='delete_input_row(\"" + next_element_block_id + "\", task_data.code_sections, " + next_element_number + ");'>" +
                                "       <i class='material-icons'>delete</i>" +
                                "   </a>" +
                                "   <div class='col s11 ace-editor' ace='" + (!is_restore ? "initialize_code_section" : "restore_code_section") + "' ng-model='task_data.code_sections[" + next_element_number + "].content'></div>" +
                                "</div>"
                            )($scope)
                        );
                        break;

                    case "file":
                        collection[next_element_number] = [];
                        element_id_prefix = "file_section_";
                        element_id_block_prefix = element_id_prefix + "block_";
                        next_element_id = element_id_prefix + next_element_number;
                        next_element_block_id = element_id_block_prefix + next_element_number;
                        section_element.append(
                            $compile(
                                "<div id=\"" + next_element_block_id + "\">\n" +
                                "   <div class=\"file-field input-field\" id=\"" + next_element_id + "\">\n" +
                                "       <a style='z-index: 1; position: relative;' class='btn-small red waves-light'" +
                                "          ng-click='delete_input_row(\"" + next_element_block_id + "\", task_data.files, " + next_element_number + ");'>" +
                                "           <i class='material-icons'>delete</i>" +
                                "       </a>\n" +
                                "       <div class=\"btn\">\n" +
                                "           <span>Files</span>\n" +
                                "           <input type=\"file\" multiple>\n" +
                                "       </div>\n" +
                                "       <div class=\"file-path-wrapper\">\n" +
                                "           <input class=\"file-path validate\" type=\"text\" placeholder=\"Upload one or more files\">\n" +
                                "       </div>\n" +
                                "   </div>\n" +
                                "</div>"
                            )($scope)
                        );
                        break;
                }
            };

            $scope.delete_input_row = (block_id, collection, number) => {
                $("#" + block_id).remove();
                delete collection[number];
            };

            $scope.add_list_item = (new_val_model_name, collection) => {
                let new_val = $scope[new_val_model_name];
                $scope[new_val_model_name] = "";
                let is_exists = collection.filter((elem) => elem.toLowerCase() === new_val.toLowerCase()).length !== 0;
                if (!is_exists) {
                    collection.push(new_val);
                } else {
                    alertify.error("This value already exists in this list.");
                }
            };

            $scope.edit_list_item = (collection, item) => {
                let old_val = item;
                let item_idx = collection.indexOf(item);
                collection[item_idx] = "";
                let new_option = prompt("Edit option:", old_val);
                if (new_option) {
                    let is_exists = collection.filter((elem) => elem.toLowerCase() === new_option.toLowerCase()).length !== 0;
                    if (!is_exists) {
                        collection[item_idx] = new_option;
                        return true;
                    } else {
                        alertify.error("This value already exists in this list.");
                    }
                }
                collection[item_idx] = old_val;
                return false;
            };

            $scope.delete_list_item = (collection, item) => {
                collection.splice(collection.indexOf(item), 1);
            };

            $scope.get_task_details = (task_id) => {
                admin_tasks_s.get_task_details(task_id).done((task_data) => {
                    attach_extract_chips_data_to_specific_collection("task_data","get_search_keywords","search_keywords");

                    // Init files section
                    $scope.task_data.files = [];
                    $scope.task_data.files[0] = [];

                    $("#search_keywords").chips({
                        data: prepare_data_for_chips(task_data.search_keywords),
                        placeholder: "Keyword",
                        secondaryPlaceholder: "+Keyword"
                    });

                    init_task_text_soft_answer_chips("task_text_soft_answer", task_data.answer);

                    $scope.get_all_topics().done(() => {
                        $scope.get_topic_by_id(task_data.topic_id).done((topic_data) => {
                            task_data.topic_name = topic_data.name;
                        });
                    });

                    let temp_code_sections = task_data.code_sections;
                    task_data.code_sections = [];
                    for (let i = 0; i < temp_code_sections.length; i++) {
                        task_data.code_sections[i] = temp_code_sections[i];
                        $scope.add_input_row('codes_section', 'code', task_data.code_sections, true);
                    }

                    let temp_answer_options = task_data.answer_options;
                    task_data.answer_options = [];
                    for (let i = 0; i < temp_answer_options.length; i++) {
                        $scope.new_boolean_option = temp_answer_options[i];
                        $scope.add_new_boolean_option();
                    }

                    $interval(() => {
                        $scope.original_task_title = task_data.title;
                        $timeout(() => {
                            $('.materialize-textarea').each((idx, elem) => M.textareaAutoResize(elem));
                            M.updateTextFields();
                            $('select').formSelect();
                        }, 10);
                    }, 10, 50);
                });
            };

            // View tasks page
            $scope.init_view_tasks_page = () => {
                /*let exist_topics = {
                    topics_list: [],
                    first_tasks: []
                };

                $scope.validate_and_update_if_topic_already_exists = (topic_id, task_id) => {
                    if (!exist_topics.topics_list.includes(topic_id)) {
                        exist_topics.topics_list.push(topic_id);
                        exist_topics.first_tasks.push(task_id);
                        return false;
                    } else if (exist_topics.first_tasks.includes(task_id)) {
                        return false;
                    }
                    return true;
                };*/

                let draggable_elements;

                // Set draggable events
                function handleDragStart(e) {
                    this.style.opacity = '0.4';  // this / e.target is the source node.

                    e.dataTransfer.effectAllowed = 'move';
                    let transfer_data = {
                        inner_topic_order: this.attributes.inner_topic_order.value,
                        topic_id: this.attributes.topic_id.value,
                        task_id: this.attributes.task_id.value
                    };
                    e.dataTransfer.setData('text/plain', JSON.stringify(transfer_data));
                }

                function handleDragOver(e) {
                    if (e.preventDefault) {
                        e.preventDefault(); // Necessary. Allows us to drop.
                    }

                    e.dataTransfer.dropEffect = 'move';  // See the section on the DataTransfer object.

                    return false;
                }

                function handleDragEnter(e) {
                    // this / e.target is the current hover target.
                    this.classList.add('dragover');
                }

                function handleDragLeave(e) {
                    this.classList.remove('dragover');  // this / e.target is previous target element.
                }

                function handleDrop(e) {
                    // this / e.target is current target element.

                    if (e.stopPropagation) {
                        e.stopPropagation(); // stops the browser from redirecting.
                    }

                    // See the section on the DataTransfer object.

                    let data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    $scope.reorder_task(data.task_id, this.attributes.inner_topic_order.value, $scope.topics_list.data[this.attributes.topic_id.value]).done(() => {
                        set_events();
                    });

                    return false;
                }

                function handleDragEnd(e) {
                    // this/e.target is the source node.

                    [].forEach.call(draggable_elements, function (elem) {
                        elem.classList.remove('dragover');
                    });
                }

                let set_events = () => {
                    preloader.start();
                    $timeout(() => {
                        draggable_elements = document.querySelectorAll("[draggable='true']");
                        [].forEach.call(draggable_elements, function(elem) {
                            elem.addEventListener('dragstart', handleDragStart, false);
                            elem.addEventListener('dragenter', handleDragEnter, false);
                            elem.addEventListener('dragover', handleDragOver, false);
                            elem.addEventListener('dragleave', handleDragLeave, false);
                            elem.addEventListener('drop', handleDrop, false);
                            elem.addEventListener('dragend', handleDragEnd, false);
                        });
                        preloader.stop();
                    }, 2000);
                };

                $scope.get_all_tasks().done(() => {
                    $scope.get_all_topics().done(() => {
                        set_events();
                    });
                });
            };

            // Modify task page
            $scope.init_modify_task_page = () => {
            };

            // Create task page
            $scope.init_create_new_task_page = () => {
                $scope.task_data = {};
                $scope.task_data.answer = [];
                $scope.task_data.code_sections = [];
                $scope.task_data.files = [];
                $scope.task_data.judgement_criteria = [];
                $scope.task_data.hints = [];
                $scope.task_data.topic_name = '';
                $scope.task_data.check_point = 'NONE';
                $scope.task_data.files[0] = [];
                $scope.task_data.code_sections[0] = '';
                $scope.task_data.answer_type = 'TEXT_STRONG';
                $scope.task_data.answer_options = ['Option 1'];
                $scope.task_data.plan_exceptions = []; // TODO
                attach_extract_chips_data_to_specific_collection("task_data","get_search_keywords","search_keywords");

                $scope.get_all_topics().done(() => {
                    $interval(() => {
                        $timeout(() => {
                            $('select').formSelect();
                        }, 10);
                    }, 10, 50);
                    //prepare_get_dependencies_function("dependencies_topics");
                });

                $("#search_keywords").chips({
                    placeholder: "Keyword",
                    secondaryPlaceholder: "+Keyword"
                });

                init_task_text_soft_answer_chips("task_text_soft_answer");
            };
        };
    });