/**
 * Created by Roman on 17.06.2015.
 */
define([
    'text!templates/Revenue/index.html',
    'text!templates/Revenue/weeksArray.html',
    'text!templates/Revenue/tableByDep.html',
    'text!templates/Revenue/bySalesByDep.html',
    'text!templates/Revenue/perWeek.html',
    'models/Revenue',
    'moment',
    'dataService',
    'async'
], function (mainTemplate, weeksArray, tableByDep, bySalesByDep, perWeek, RevenueModel, moment, dataService, async) {
    var View = Backbone.View.extend({
        el: '#content-holder',

        template: _.template(mainTemplate),
        weeksArrayTemplate: _.template(weeksArray),
        bySalesByDepTemplate: _.template(bySalesByDep),
        tableByDepTemplate: _.template(tableByDep),
        bySalesPerWeekTemplate: _.template(perWeek),

        $currentStartWeek: null,
        $revenueBySales: null,
        $revenueBySales: null,

        events: {
            'change #currentStartWeek': 'changeWeek'
        },

        initialize: function () {
            var self = this;

            this.model = new RevenueModel();
            this.listenTo(this.model, 'change:currentYear', this.changeYear);
            this.listenTo(this.model, 'change:currentStartWeek', this.changeWeek);
            this.listenTo(this.model, 'change:weeksArr', this.changeWeeksArr);
            this.listenTo(this.model, 'change:bySalesData', this.changeBySalesData);
            this.listenTo(this.model, 'change:byDepData', this.changeByDepData);

            var currentStartWeek = moment().week() - 6;
            var currentYear = moment().weekYear();
            var currentMonth = parseInt(moment().week(currentStartWeek).format("MM"));

            this.changeWeek = _.debounce(this.updateWeek, 500);

            this.model.set({
                currentStartWeek: currentStartWeek,
                currentYear: currentYear,
                currentMonth: currentMonth
            });

            //this.render();

            dataService.getData('/employee/bySales', null, function (employess) {
                self.render(employess);
            });
        },

        getDate: function (num) {
            return moment().day("Monday").week(num).format("DD.MM");
        },

        getModelValue: function (attr) {
            return this.model.get(attr);
        },

        updateWeek: function () {
            var modelData;
            var currentStartWeek = parseInt(this.$currentStartWeek.val());
            var currentYear = this.model.get('currentYear');
            var newCurrMonth;
            var yearOfMonth;

            if (currentStartWeek === 0) {
                currentStartWeek = 53;
                currentYear -= 1;
            }
            if (currentStartWeek) {
                if (currentStartWeek > 53) {
                    currentStartWeek = 1;
                    currentYear += 1;
                }
                if (currentStartWeek < 1) {
                    currentStartWeek = 53;
                    currentYear -= 1;
                }
            }
            if (currentYear < 2014) {
                currentYear = 2014;
            }

            newCurrMonth = parseInt(moment().week(currentStartWeek).format("MM"));

            if (currentStartWeek === 1) {
                yearOfMonth = currentYear - 1;
            } else {
                yearOfMonth = currentYear;
            }

            modelData = {
                currentStartWeek: currentStartWeek,
                currentYear: currentYear,
                yearOfMonth: yearOfMonth,
                newCurrMonth: newCurrMonth
            };

            this.model.set(modelData);

            return false;
        },

        changeWeek: function () {
            var prevVal = this.model.previous('currentStartWeek');
            var weekVal = this.model.get('currentStartWeek');

            if (prevVal === 53) {
                this.$currentStartWeek.val(weekVal);
            }

            this.sendRequest();
        },

        changeYear: function () {
            var thisEl = this.$el;
            var year = thisEl.find('#currentYear');
            var yearVal = this.model.get('currentYear');

            year.text(yearVal);
        },

        changeWeeksArr: function () {
            var self = this;
            this.weekArr = this.getModelValue('weeksArr');

            if (!this.rendered) {
                return setTimeout(function () {
                    self.changeWeeksArr();
                }, 10);
            }

            this.$revenueBySales.html(this.weeksArrayTemplate({weeksArr: this.weekArr}));
        },

        sendRequest: function () {
            var model = this.model.toJSON();
            var weeksArr = [];
            var week;

            if (model.currentMonth !== model.newCurrMonth) {
                model.currentMonth = model.newCurrMonth;
            }

            for (var i = 0; i <= 13; i++) {
                if (model.currentStartWeek + i > 53) {
                    week = model.currentStartWeek + i - 53;
                    weeksArr.push({
                        lastDate: this.getDate(week),
                        week: week,
                        year: model.currentYear + 1
                    });
                } else {
                    week = model.currentStartWeek + i;
                    weeksArr.push({
                        lastDate: this.getDate(week),
                        week: week,
                        year: model.currentYear
                    });
                }
            }

            this.fetchBySales();
            this.fetchByDeps();

            this.model.set('weeksArr', weeksArr);
        },

        fetchBySales: function () {
            var self = this;
            var data = {
                week: this.model.get('currentStartWeek'),
                year: this.model.get('currentYear')
            };

            dataService.getData('/revenue/bySales', data, function (bySalesData) {
                self.model.set('bySalesData', bySalesData);
            });
        },

        fetchByDeps: function () {
            var self = this;
            var data = {
                week: this.model.get('currentStartWeek'),
                year: this.model.get('currentYear')
            };

            dataService.getData('/revenue/byDepartment', data, function (byDepData) {
                self.model.set('byDepData', byDepData);
            });
        },

        changeBySalesData: function () {
            var self = this;
            var weeksArr = this.model.get('weeksArr');
            var bySalesByDep = this.model.get('bySalesData');

            var targetTotal = $(self.$el.find('[data-content="totalBySales"]'));

            var bySalesByDepPerWeek = {};
            var tempPerWeek;
            var globalTotal = 0;

            async.each(this.employees, function (employee, cb) {
                var employeeId = employee._id;
                var target = $(self.$el.find('[data-id="' + employeeId + '"]'));

                var byWeekData;
                var total;
                var bySalesByDepPerEmployee;


                bySalesByDepPerEmployee = _.find(bySalesByDep, function (el) {
                    return el._id === employeeId;
                });


                if (bySalesByDepPerEmployee) {
                    byWeekData = _.groupBy(bySalesByDepPerEmployee.root, 'week');
                    total = bySalesByDepPerEmployee.total;
                    globalTotal += total;
                    target.html(self.bySalesByDepTemplate({
                        weeksArr: weeksArr,
                        byWeekData: byWeekData,
                        total: total,
                        bySalesByDepPerWeek: bySalesByDepPerWeek
                    }));
                }
                cb();
            }, function (err) {
                if (err) {
                    alert(err);
                }

                for (var i = bySalesByDep.length - 1; i >= 0; i--) {
                    tempPerWeek = bySalesByDep[i].root;
                    tempPerWeek.forEach(function (weekResault) {
                        if (!(weekResault.week in bySalesByDepPerWeek)) {
                            bySalesByDepPerWeek[weekResault.week] = weekResault.revenue;
                        } else {
                            bySalesByDepPerWeek[weekResault.week] += weekResault.revenue;
                        }
                    });
                }

                targetTotal.html(self.bySalesPerWeekTemplate({
                    weeksArr: weeksArr,
                    bySalesByDepPerWeek: bySalesByDepPerWeek,
                    globalTotal: globalTotal
                }));

                return false;
            });
        },

        changeByDepData: function () {
            var self = this;
            var weeksArr = this.model.get('weeksArr');
            var bySalesByDep = this.model.get('byDepData');

            var target = $(self.$el.find('#tableByDep'));
            var targetTotal;

            var bySalesByDepPerWeek = {};
            var tempPerWeek;
            var globalTotal = 0;

            this.departments = [];

            for (var i = bySalesByDep.length - 1; i >= 0; i--) {
                this.departments.push(bySalesByDep[i]._id);

                tempPerWeek = bySalesByDep[i].root;
                tempPerWeek.forEach(function (weekResault) {
                    if (!(weekResault.week in bySalesByDepPerWeek)) {
                        bySalesByDepPerWeek[weekResault.week] = weekResault.revenue;
                    } else {
                        bySalesByDepPerWeek[weekResault.week] += weekResault.revenue;
                    }
                });
            }

            target.html(this.tableByDepTemplate({departments: this.departments}));
            target.find('.revenueBySales').html(this.weeksArrayTemplate({weeksArr: this.weekArr}));
            targetTotal = $(self.$el.find('[data-content="totalByDep"]'));

            async.each(this.departments, function (department, cb) {
                var target = $(self.$el.find('[data-id="' + department + '"]'));

                var byWeekData;
                var total;
                var bySalesByDepPerEmployee;


                bySalesByDepPerEmployee = _.find(bySalesByDep, function (el) {
                    return el._id === department;
                });


                if (bySalesByDepPerEmployee) {
                    byWeekData = _.groupBy(bySalesByDepPerEmployee.root, 'week');
                    total = bySalesByDepPerEmployee.total;
                    globalTotal += total;
                    target.html(self.bySalesByDepTemplate({
                        weeksArr: weeksArr,
                        byWeekData: byWeekData,
                        total: total,
                        bySalesByDepPerWeek: bySalesByDepPerWeek
                    }));
                }
                cb();
            }, function (err) {
                if (err) {
                    alert(err);
                }

                targetTotal.html(self.bySalesPerWeekTemplate({
                    weeksArr: weeksArr,
                    bySalesByDepPerWeek: bySalesByDepPerWeek,
                    globalTotal: globalTotal
                }));

                return false;
            });
        },

        render: function (employees) {
            var self = this;
            var thisEl = this.$el;
            var model = this.model.toJSON();

            this.employees = employees;

            model.employees = employees;

            this.$el.html(this.template(model));

            this.$currentStartWeek = thisEl.find('#currentStartWeek');
            this.$revenueBySales = thisEl.find('#revenueBySales');

            this.rendered = true;

            return this;
        }
    });

    return View;
});