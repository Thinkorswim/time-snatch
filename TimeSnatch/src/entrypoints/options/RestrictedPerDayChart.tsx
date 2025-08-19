"use client"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Bar, BarChart, CartesianGrid, XAxis, LabelList } from "recharts"

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"

import {
    ChartConfig,
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
} from "@/components/ui/chart"
import { timeDisplayFormat } from "@/lib/utils"
import { Button } from "@/components/ui/button"


type RestrictedPerDayChartProps = {
    historicalRestrictedTimePerDay: Record<string, Record<string, number>>,
}

export function RestrictedPerDayChart({ historicalRestrictedTimePerDay }: RestrictedPerDayChartProps) {

    const [selectedDay, setSelectedDay] = useState(new Date());
    const [chartData, setChartData] = useState<any[]>([]);
    const [chartConfig, setChartConfig] = useState<ChartConfig>({});
    const [currentDateWindows, setCurrentDateWindows] = useState<string>("");

    useEffect(() => {
        calculateChartData();
    }, [selectedDay, historicalRestrictedTimePerDay]);

    const moveBackwards = () => {
        setSelectedDay(new Date(selectedDay.getTime() - 7 * 24 * 60 * 60 * 1000));
    }

    const moveForward = () => {
        setSelectedDay(new Date(selectedDay.getTime() + 7 * 24 * 60 * 60 * 1000));
    }

    const calculateChartData = () => {

        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const date = new Date(selectedDay)
            date.setDate(selectedDay.getDate() - i)
            return date.toLocaleDateString('en-CA').slice(0, 10)
        }).reverse()

        let mostVisitedWebsites: Record<string, number> = {};

        for (const date of last7Days) {
            if (historicalRestrictedTimePerDay[date]) {
                for (const website in historicalRestrictedTimePerDay[date]) {
                    if (historicalRestrictedTimePerDay[date][website] > 0) {
                        if (mostVisitedWebsites[website]) {
                            mostVisitedWebsites[website] += historicalRestrictedTimePerDay[date][website];
                        } else {
                            mostVisitedWebsites[website] = historicalRestrictedTimePerDay[date][website];
                        }
                    }
                }
            }
        }

        const sortedWebsites = Object.entries(mostVisitedWebsites).sort((a, b) => b[1] - a[1]).slice(0, 5);

        const chartConfig = sortedWebsites.reduce((acc, [key, value], index) => {
            acc[key] = {
                label: key,
                color: `hsl(var(--chart-${index + 1}))`,
            }
            return acc;
        }, {} as ChartConfig)

        if (mostVisitedWebsites.length > 5 || Object.keys(chartConfig).length === 0) {
            const lastWebsite = Object.keys(chartConfig).pop() as string;
            delete chartConfig[lastWebsite];
            chartConfig["others"] = {
                label: "Others",
                color: "hsl(var(--chart-5))",
            }
        }

        let chartData: any = [];
        let encounteredMonday = false;
        chartData = last7Days.reverse().map((date) => {
            const dayOfWeek = new Date(date).getDay();

            if (dayOfWeek === 0) {
                encounteredMonday = true;
            }
            const isRecent = !encounteredMonday;

            const data: Record<string, number | string> = {
                day: isRecent && selectedDay.toDateString() === new Date().toDateString()
                    ? new Date(date).toLocaleDateString('en-CA', { weekday: 'long' })
                    : new Date(date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })
            };
            let othersTotal = 0;

            for (const website in historicalRestrictedTimePerDay[date] || {}) {
                if (chartConfig[website]) {
                    data[website] = historicalRestrictedTimePerDay[date][website];
                } else {
                    othersTotal += historicalRestrictedTimePerDay[date][website];
                }
            }

            for (const website in chartConfig) {
                if (!data[website]) {
                    data[website] = 0;
                }
            }

            if (othersTotal > 0) {
                data["others"] = othersTotal;
            }

            return data;
        });

        chartData.reverse();

        const sevenDaysAgo = new Date(selectedDay);
        sevenDaysAgo.setDate(selectedDay.getDate() - 6);
        const currentDateWindows = `
            ${sevenDaysAgo.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })} - 
            ${selectedDay.toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}`;

        setCurrentDateWindows(currentDateWindows);
        setChartData(chartData);
        setChartConfig(chartConfig);
    }

    return (
        <Card>
            <CardHeader className="flex flex-row justify-between items-start space-y-0 pb-2">
                <div>
                    <CardTitle className="text-2xl">Time spent on distracting websites</CardTitle>
                    <CardDescription className="mt-1">{currentDateWindows}</CardDescription>
                </div>
                <div>
                    <Button className="mr-1" onClick={moveBackwards}> <ChevronLeft className='w-5 h-5' /> </Button>
                    <Button disabled={selectedDay.toDateString() === new Date().toDateString()} onClick={moveForward} > <ChevronRight className='w-5 h-5' /> </Button>
                </div>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig}>
                    <BarChart accessibilityLayer data={chartData} margin={{
                        top: 30,
                    }}>
                        <CartesianGrid vertical={false} />
                        <XAxis
                            dataKey="day"
                            tickLine={false}
                            tickMargin={10}
                            axisLine={false}
                        />
                        <ChartTooltip content={<ChartTooltipContent hideLabel hideIndicator isTime={true} />} />

                        {Object.entries(chartConfig).map(([key, value], index) => {
                            return (
                                <Bar
                                    key={key}
                                    dataKey={key}
                                    stackId="a"
                                    fill={value.color}
                                    radius={
                                        [0, 0, 0, 0]
                                    }
                                >
                                    {index === Object.keys(chartConfig).length - 1 && <LabelList
                                        position="top"
                                        offset={12}
                                        className="fill-muted-foreground font-geistmono text-sm"
                                        formatter={(value: number) => {
                                            return timeDisplayFormat(value, false, true)
                                        }}
                                    />}
                                </Bar>
                            )
                        })}
                    </BarChart>
                </ChartContainer>
            </CardContent>
        </Card>
    )
}